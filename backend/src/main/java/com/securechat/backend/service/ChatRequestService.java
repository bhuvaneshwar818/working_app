package com.securechat.backend.service;

import com.securechat.backend.dto.ChatRequestDto;
import com.securechat.backend.enums.RequestStatus;
import com.securechat.backend.models.ChatRequest;
import com.securechat.backend.models.User;
import com.securechat.backend.repository.ChatRequestRepository;
import com.securechat.backend.repository.UserRepository;
import com.securechat.backend.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ChatRequestService {

    private final ChatRequestRepository chatRequestRepository;
    private final UserRepository userRepository;
    private final MessageRepository messageRepository;

    public ChatRequestDto sendRequest(String senderUsername, String receiverUsername) {
        if (senderUsername.equals(receiverUsername)) {
            throw new RuntimeException("Cannot send a request to yourself");
        }

        User sender = userRepository.findByUsername(senderUsername)
                .orElseThrow(() -> new RuntimeException("Sender not found"));
        User receiver = userRepository.findByUsername(receiverUsername)
                .orElseThrow(() -> new RuntimeException("Receiver not found"));

        if (chatRequestRepository.findRequestBetweenUsers(sender, receiver).isPresent()) {
            throw new RuntimeException("A chat request already exists between these users");
        }

        if (!receiver.isAllowIncomingRequests()) {
            throw new RuntimeException("This user is currently not accepting incoming requests.");
        }

        ChatRequest request = ChatRequest.builder()
                .sender(sender)
                .receiver(receiver)
                .status(RequestStatus.PENDING)
                .build();

        ChatRequest savedRequest = chatRequestRepository.save(request);

        return mapToDto(savedRequest, senderUsername);
    }

    public List<ChatRequestDto> getPendingRequests(String receiverUsername) {
        User receiver = userRepository.findByUsername(receiverUsername)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return chatRequestRepository.findByReceiverAndStatus(receiver, RequestStatus.PENDING)
                .stream()
                .map(r -> mapToDto(r, receiverUsername))
                .collect(Collectors.toList());
    }

    public List<ChatRequestDto> getSentRequests(String senderUsername) {
        User sender = userRepository.findByUsername(senderUsername)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return chatRequestRepository.findBySenderAndStatus(sender, RequestStatus.PENDING)
                .stream()
                .map(r -> mapToDto(r, senderUsername))
                .collect(Collectors.toList());
    }

    public List<ChatRequestDto> getActiveChats(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<ChatRequest> asReceiver = chatRequestRepository.findByReceiverAndStatus(user, RequestStatus.ACCEPTED);
        List<ChatRequest> asSender = chatRequestRepository.findBySenderAndStatus(user, RequestStatus.ACCEPTED);
        
        asReceiver.addAll(asSender);
        return asReceiver.stream()
                .map(r -> mapToDto(r, username))
                .collect(Collectors.toList());
    }

    public ChatRequestDto acceptRequest(UUID requestId, String receiverUsername) {
        ChatRequest request = chatRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Chat request not found"));

        if (!request.getReceiver().getUsername().equals(receiverUsername)) {
            throw new RuntimeException("Unauthorized: You can only accept requests destined for you");
        }

        request.setStatus(RequestStatus.ACCEPTED);
        
        // Trust update: Both users get a success point
        User sender = request.getSender();
        User receiver = request.getReceiver();
        sender.setSuccessfulConnectionsCount(sender.getSuccessfulConnectionsCount() + 1);
        receiver.setSuccessfulConnectionsCount(receiver.getSuccessfulConnectionsCount() + 1);
        userRepository.save(sender);
        userRepository.save(receiver);

        ChatRequest updatedRequest = chatRequestRepository.save(request);

        return mapToDto(updatedRequest, receiverUsername);
    }

    public ChatRequestDto rejectRequest(UUID requestId, String receiverUsername) {
        ChatRequest request = chatRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Chat request not found"));

        if (!request.getReceiver().getUsername().equals(receiverUsername)) {
            throw new RuntimeException("Unauthorized: You can only reject requests destined for you");
        }

        request.setStatus(RequestStatus.REJECTED);
        ChatRequest updatedRequest = chatRequestRepository.save(request);

        return mapToDto(updatedRequest, receiverUsername);
    }

    @org.springframework.transaction.annotation.Transactional
    public void reportTrustIssue(UUID requestId, String reporterUsername) {
        ChatRequest request = chatRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Chat connection not found"));

        if (!request.getSender().getUsername().equals(reporterUsername) && !request.getReceiver().getUsername().equals(reporterUsername)) {
            throw new RuntimeException("Unauthorized");
        }

        User peer = request.getSender().getUsername().equals(reporterUsername) ? request.getReceiver() : request.getSender();
        
        peer.setTrustBreakCount(peer.getTrustBreakCount() + 1);
        userRepository.save(peer);

        messageRepository.deleteByChatRequestId(requestId);
        chatRequestRepository.delete(request);
    }

    @org.springframework.transaction.annotation.Transactional
    public void deleteConnection(UUID requestId, String username) {
        ChatRequest request = chatRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Chat connection not found"));

        if (!request.getSender().getUsername().equals(username) && !request.getReceiver().getUsername().equals(username)) {
            throw new RuntimeException("Unauthorized");
        }

        messageRepository.deleteByChatRequestId(requestId);
        chatRequestRepository.delete(request);
    }

    @org.springframework.transaction.annotation.Transactional
    public void togglePin(UUID requestId, String username) {
        ChatRequest request = chatRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Chat not found"));
        if (request.getSender().getUsername().equals(username)) {
            request.setSenderPinned(!request.isSenderPinned());
        } else if (request.getReceiver().getUsername().equals(username)) {
            request.setReceiverPinned(!request.isReceiverPinned());
        } else {
            throw new RuntimeException("Unauthorized");
        }
        chatRequestRepository.save(request);
    }




    private ChatRequestDto mapToDto(ChatRequest request, String currentUsername) {
        long unreads = 0;
        User currentUser = null;
        if (currentUsername != null) {
            currentUser = userRepository.findByUsername(currentUsername).orElse(null);
        }

        if (currentUser != null) {
            unreads = messageRepository.countUnread(
                request.getId(), currentUser.getUsername(), com.securechat.backend.enums.MessageStatus.SEEN
            );
        }

        User sender = userRepository.findByUsername(request.getSender().getUsername()).orElse(request.getSender());
        User receiver = userRepository.findByUsername(request.getReceiver().getUsername()).orElse(request.getReceiver());

        User peer = currentUsername != null && currentUsername.equalsIgnoreCase(sender.getUsername()) ? receiver : sender;
        String peerPicture = peer.isProfilePhotoPublic() ? peer.getProfilePicture() : null;

        boolean isPinned = false;
        if (currentUsername != null) {
            isPinned = currentUsername.equalsIgnoreCase(sender.getUsername()) ? request.isSenderPinned() : request.isReceiverPinned();
        }

        return ChatRequestDto.builder()
                .id(request.getId())
                .senderUsername(sender.getUsername())
                .senderProfilePicture(sender.isProfilePhotoPublic() ? sender.getProfilePicture() : null)
                .receiverUsername(receiver.getUsername())
                .receiverProfilePicture(receiver.isProfilePhotoPublic() ? receiver.getProfilePicture() : null)
                .peerProfilePicture(peerPicture)
                .status(request.getStatus())
                .createdAt(request.getCreatedAt())
                .unreadCount(unreads)
                .isPinned(isPinned)
                .build();
    }
}
