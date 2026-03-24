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

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MessageService {

    private final MessageRepository messageRepository;
    private final ChatRequestRepository chatRequestRepository;
    private final UserRepository userRepository;

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

        Message message = Message.builder()
                .chatRequest(chatRequest)
                .sender(sender)
                .content(messageDto.getContent())
                .messageType(messageDto.getType() != null ? messageDto.getType() : com.securechat.backend.enums.MessageType.TEXT)
                .status(MessageStatus.SENT)
                .evaporateTime(messageDto.getEvaporateTime())
                .build();

        Message savedMessage = messageRepository.save(message);

        return mapToResponse(savedMessage);
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

        java.util.List<Message> messages = messageRepository.findByChatRequestOrderByCreatedAtAsc(chatRequest);
        
        boolean updated = false;
        for (Message m : messages) {
             if (!m.getSender().getUsername().equals(username) && m.getStatus() != MessageStatus.SEEN) {
                  m.setStatus(MessageStatus.SEEN);
                  updated = true;
             }
        }
        if (updated) {
             messageRepository.saveAll(messages);
        }

        return messages
                .stream()
                .map(this::mapToResponse)
                .collect(java.util.stream.Collectors.toList());
    }
}
