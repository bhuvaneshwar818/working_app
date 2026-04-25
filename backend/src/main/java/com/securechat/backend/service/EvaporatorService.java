package com.securechat.backend.service;

import com.securechat.backend.dto.ChatMessageResponse;
import com.securechat.backend.enums.MessageStatus;
import com.securechat.backend.enums.MessageType;
import com.securechat.backend.models.EvaporatorMessage;
import com.securechat.backend.models.User;
import com.securechat.backend.repository.EvaporatorMessageRepository;
import com.securechat.backend.repository.UserRepository;
import com.securechat.backend.utils.EncryptionUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class EvaporatorService {

    private final EvaporatorMessageRepository evaporatorMessageRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final EncryptionUtil encryptionUtil;

    public ChatMessageResponse saveMessage(String senderUsername, String recipientUsername, String content, MessageType type, Integer evaporateTime) {
        User sender = userRepository.findByUsername(senderUsername).orElseThrow();
        User recipient = userRepository.findByUsername(recipientUsername).orElseThrow();

        EvaporatorMessage message = EvaporatorMessage.builder()
                .sender(sender)
                .recipient(recipient)
                .content(encryptionUtil.encrypt(content))
                .messageType(type != null ? type : MessageType.TEXT)
                .status(MessageStatus.SENT)
                .evaporateTime(evaporateTime)
                .build();

        EvaporatorMessage saved = evaporatorMessageRepository.save(message);

        // Notify recipient dashboard
        messagingTemplate.convertAndSendToUser(recipientUsername, "/queue/updates", "NEW_EVAP_MESSAGE:" + senderUsername);

        return mapToResponse(saved);
    }

    public List<ChatMessageResponse> getMessagesAndVaporize(String viewerName, String peerName) {
        User viewer = userRepository.findByUsername(viewerName).orElseThrow();
        User peer = userRepository.findByUsername(peerName).orElseThrow();

        // 1. Get incoming messages from peer
        List<EvaporatorMessage> incoming = evaporatorMessageRepository.findByRecipientAndSenderOrderByCreatedAtAsc(viewer, peer);
        
        // 2. Map for response
        List<ChatMessageResponse> results = incoming.stream().map(this::mapToResponse).collect(Collectors.toList());

        // 3. ATOMIC VAPORIZATION: Immediately delete from separate database table
        if (!incoming.isEmpty()) {
            evaporatorMessageRepository.deleteAll(incoming);
            
            // Broadcast a cleanup signal (optional but clean)
            messagingTemplate.convertAndSendToUser(peerName, "/queue/updates", "EVAP_WIPED_BY_PEER");
        }

        return results;
    }

    public long getUnreadSendersCount(String username) {
        User recipient = userRepository.findByUsername(username).orElseThrow();
        return evaporatorMessageRepository.countDistinctSendersByRecipient(recipient);
    }

    public Map<String, Long> getUnreadCountsPerSender(String username) {
        User recipient = userRepository.findByUsername(username).orElseThrow();
        List<Object[]> results = evaporatorMessageRepository.countMessagesPerSenderForRecipient(recipient);
        Map<String, Long> counts = new HashMap<>();
        for (Object[] result : results) {
            counts.put((String) result[0], (Long) result[1]);
        }
        return counts;
    }

    private ChatMessageResponse mapToResponse(EvaporatorMessage message) {
        return ChatMessageResponse.builder()
                .id(message.getId())
                .senderUsername(message.getSender().getUsername())
                .content(encryptionUtil.decrypt(message.getContent()))
                .messageType(message.getMessageType())
                .status(message.getStatus())
                .evaporateTime(message.getEvaporateTime())
                .createdAt(message.getCreatedAt())
                .build();
    }
}
