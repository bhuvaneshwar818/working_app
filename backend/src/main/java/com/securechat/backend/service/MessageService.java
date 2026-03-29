package com.securechat.backend.service;

import com.securechat.backend.dto.ChatMessageResponse;
import com.securechat.backend.dto.MessageDto;
import com.securechat.backend.enums.MessageStatus;
import com.securechat.backend.enums.RequestStatus;
import com.securechat.backend.models.ChatRequest;
import com.securechat.backend.models.Message;
import com.securechat.backend.models.User;
import com.securechat.backend.repository.ChatRequestRepository;
import com.securechat.backend.repository.MessageRepository;
import com.securechat.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class MessageService {

    private final MessageRepository messageRepository;
    private final ChatRequestRepository chatRequestRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final OnlineStatusService onlineStatusService;

    public ChatMessageResponse saveMessage(String senderUsername, MessageDto messageDto) {
        User sender = userRepository.findByUsername(senderUsername)
                .orElseThrow(() -> new RuntimeException("Sender not found"));

        ChatRequest chatRequest = chatRequestRepository.findById(messageDto.getChatRequestId())
                .orElseThrow(() -> new RuntimeException("Chat request/room not found"));

        if (!chatRequest.getStatus().equals(RequestStatus.ACCEPTED)) {
            throw new RuntimeException("Cannot send message. Chat request is not approved.");
        }

        boolean isSender = chatRequest.getSender().getId().equals(sender.getId());
        boolean isReceiver = chatRequest.getReceiver().getId().equals(sender.getId());

        if (!isSender && !isReceiver) {
            throw new RuntimeException("Unauthorized to send message in this room");
        }

        String receiverUsername = isSender ? chatRequest.getReceiver().getUsername() : chatRequest.getSender().getUsername();
        boolean isReceiverOnline = onlineStatusService.getOnlineUsers().contains(receiverUsername);

        Message message = Message.builder()
                .chatRequest(chatRequest)
                .sender(sender)
                .content(messageDto.getContent())
                .messageType(messageDto.getType() != null ? messageDto.getType() : com.securechat.backend.enums.MessageType.TEXT)
                .status(isReceiverOnline ? MessageStatus.DELIVERED : MessageStatus.SENT)
                .evaporateTime(messageDto.getEvaporateTime())
                .build();

        Message savedMessage = messageRepository.save(message);
        System.out.println("DEBUG: Saved message " + savedMessage.getId() + " for DTO chatRequestId: " + messageDto.getChatRequestId() + " and Entity ID: " + chatRequest.getId());
        ChatMessageResponse response = mapToResponse(savedMessage);

        // Notify receiver's dashboard of the new message
        messagingTemplate.convertAndSendToUser(
                chatRequest.getReceiver().getUsername().equals(sender.getUsername()) 
                    ? chatRequest.getSender().getUsername() 
                    : chatRequest.getReceiver().getUsername(),
                "/queue/updates",
                "NEW_MESSAGE"
        );

        return response;
    }

    public void markAllAsRead(UUID chatRequestId, String readerUsername) {
        ChatRequest chatRequest = chatRequestRepository.findById(chatRequestId)
                .orElseThrow(() -> new RuntimeException("Chat request not found"));

        if (!chatRequest.getSender().getUsername().equals(readerUsername) && 
            !chatRequest.getReceiver().getUsername().equals(readerUsername)) {
            throw new RuntimeException("Unauthorized source");
        }

        java.util.List<Message> messages = messageRepository.findByChatRequestOrderByCreatedAtAsc(chatRequest);
        
        boolean updated = false;
        java.util.List<Message> toDelete = new java.util.ArrayList<>();
        java.util.List<Message> toUpdate = new java.util.ArrayList<>();
        
        for (Message m : messages) {
             if (!m.getSender().getUsername().equals(readerUsername) && m.getStatus() != MessageStatus.SEEN) {
                  m.setStatus(MessageStatus.SEEN);
                  updated = true;
                  
                  // Broadcast SEEN status first so UI knows it was delivered/seen
                  messagingTemplate.convertAndSend("/topic/chat/" + chatRequestId, mapToResponse(m));
                  
                  if (m.getEvaporateTime() != null) {
                      toDelete.add(m);
                      // Notify UI that this specific message is now evaporating
                      ChatMessageResponse evaporationSignal = mapToResponse(m);
                      evaporationSignal.setContent("__EVAPORATING__");
                      messagingTemplate.convertAndSend("/topic/chat/" + chatRequestId, evaporationSignal);
                  } else {
                      toUpdate.add(m);
                  }
             }
        }
        
        if (updated) {
             if (!toUpdate.isEmpty()) messageRepository.saveAll(toUpdate);
             if (!toDelete.isEmpty()) messageRepository.deleteAll(toDelete);
             // Notify the receiver (the person who originally sent the messages) dashboard to update unread badge counts
             String senderUsername = chatRequest.getSender().getUsername().equals(readerUsername) 
                 ? chatRequest.getReceiver().getUsername() 
                 : chatRequest.getSender().getUsername();
             messagingTemplate.convertAndSendToUser(senderUsername, "/queue/updates", "MESSAGE_READ");
        }
    }

    public void markAllAsDelivered(String receiverUsername) {
        java.util.List<Message> unreadMessages = messageRepository.findByChatRequestReceiverUsernameAndStatus(receiverUsername, MessageStatus.SENT);
        if (unreadMessages.isEmpty()) return;

        for (Message m : unreadMessages) {
            m.setStatus(MessageStatus.DELIVERED);
            // Broadcast to the chat room so the sender sees the double grey ticks instantly
            messagingTemplate.convertAndSend("/topic/chat/" + m.getChatRequest().getId(), mapToResponse(m));
        }

        messageRepository.saveAll(unreadMessages);
        // We notify the senders that their messages were updated to delivered
        unreadMessages.stream().map(m -> m.getSender().getUsername()).distinct().forEach(sender -> {
            messagingTemplate.convertAndSendToUser(sender, "/queue/updates", "MESSAGE_DELIVERED");
        });
    }

    private ChatMessageResponse mapToResponse(Message message) {
        return ChatMessageResponse.builder()
                .id(message.getId())
                .chatRequestId(message.getChatRequest().getId())
                .senderUsername(message.getSender().getUsername())
                .content(message.getContent())
                .messageType(message.getMessageType())
                .status(message.getStatus())
                .evaporateTime(message.getEvaporateTime())
                .createdAt(message.getCreatedAt())
                .build();
    }

    public java.util.List<ChatMessageResponse> getMessages(UUID chatRequestId, String username) {
        ChatRequest chatRequest = chatRequestRepository.findById(chatRequestId)
                .orElseThrow(() -> new RuntimeException("Chat request not found"));

        boolean isParticipant = chatRequest.getSender().getUsername().equals(username) || 
                                chatRequest.getReceiver().getUsername().equals(username);

        if (!isParticipant) {
            throw new RuntimeException("Unauthorized source");
        }

        System.out.println("DEBUG: Fetching messages for UUID: " + chatRequestId);
        java.util.List<Message> messages = messageRepository.findByChatRequestIdOrderByCreatedAtAsc(chatRequestId);
        System.out.println("DEBUG: Found " + messages.size() + " messages for chatRequestId: " + chatRequestId);

        
        boolean updated = false;
        for (Message m : messages) {
             if (!m.getSender().getUsername().equals(username) && m.getStatus() != MessageStatus.SEEN) {
                  m.setStatus(MessageStatus.SEEN);
                  updated = true;
                  // Broadcast the specific updated message to the chat room so sender gets blue ticks immediately
                  messagingTemplate.convertAndSend("/topic/chat/" + chatRequestId, mapToResponse(m));
             }
        }
        if (updated) {
             messageRepository.saveAll(messages);
             // Notify the original sender's dashboard
             String senderUsername = chatRequest.getSender().getUsername().equals(username) 
                 ? chatRequest.getReceiver().getUsername() 
                 : chatRequest.getSender().getUsername();
             messagingTemplate.convertAndSendToUser(senderUsername, "/queue/updates", "MESSAGE_READ");
        }

        return messages
                .stream()
                .map(this::mapToResponse)
                .collect(java.util.stream.Collectors.toList());
    }

    public void wipeSeenMessages(UUID chatRequestId) {
        java.util.List<Message> seenEvaporating = messageRepository.findByChatRequestIdAndStatusAndEvaporateTimeIsNotNull(chatRequestId, MessageStatus.SEEN);
        if (!seenEvaporating.isEmpty()) {
            messageRepository.deleteAll(seenEvaporating);
        }
    }

    public UUID findRequestIdByParticipants(String username1, String username2) {
        User u1 = userRepository.findByUsername(username1).orElse(null);
        User u2 = userRepository.findByUsername(username2).orElse(null);
        if (u1 == null || u2 == null) return null;
        
        return chatRequestRepository.findRequestBetweenUsers(u1, u2)
                .map(ChatRequest::getId)
                .orElse(null);
    }
}
