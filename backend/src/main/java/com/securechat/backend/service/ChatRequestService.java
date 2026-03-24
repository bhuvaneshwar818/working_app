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

    private ChatRequestDto mapToDto(ChatRequest request, String currentUsername) {
        long unreads = 0;
        if (currentUsername != null) {
            unreads = messageRepository.countByChatRequestIdAndSenderUsernameNotAndStatusNot(
                request.getId(), currentUsername, com.securechat.backend.enums.MessageStatus.SEEN
            );
        }

        return ChatRequestDto.builder()
                .id(request.getId())
                .senderUsername(request.getSender().getUsername())
                .receiverUsername(request.getReceiver().getUsername())
                .status(request.getStatus())
                .createdAt(request.getCreatedAt())
                .unreadCount(unreads)
                .build();
    }
}
