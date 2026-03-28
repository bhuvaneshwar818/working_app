package com.securechat.backend.service;

import com.securechat.backend.dto.ChatMessageResponse;
import com.securechat.backend.dto.DarkRoomRoomDto;
import com.securechat.backend.models.DarkRoomRoom;
import com.securechat.backend.models.DarkRoomMessage;
import com.securechat.backend.models.User;
import com.securechat.backend.repository.DarkRoomRoomRepository;
import com.securechat.backend.repository.DarkRoomMessageRepository;
import com.securechat.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DarkRoomService {
    private final DarkRoomRoomRepository darkRoomRoomRepository;
    private final DarkRoomMessageRepository darkRoomMessageRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    // Track active online keys inserted in the last few seconds
    private final ConcurrentHashMap<UUID, Set<String>> activeKeys = new ConcurrentHashMap<>();

    public DarkRoomRoomDto requestRoom(String initiatorUsername, String receiverUsername) {
        if (initiatorUsername.equals(receiverUsername)) {
            throw new RuntimeException("Cannot create a room with yourself");
        }

        User initiator = userRepository.findByUsername(initiatorUsername).orElseThrow();
        User receiver = userRepository.findByUsername(receiverUsername).orElseThrow();

        if (darkRoomRoomRepository.findBetweenUsers(initiator, receiver).isPresent()) {
            throw new RuntimeException("Dark Room already exists with this user"); // Only 1 allowed 
        }

        DarkRoomRoom room = new DarkRoomRoom();
        room.setInitiator(initiator);
        room.setReceiver(receiver);
        room.setStatus("PENDING");

        darkRoomRoomRepository.save(room);
        return mapToDto(room);
    }

    public DarkRoomRoomDto acceptRoom(UUID roomId, String receiverUsername, String rawPin) {
        DarkRoomRoom room = darkRoomRoomRepository.findById(roomId).orElseThrow();
        if (!room.getReceiver().getUsername().equals(receiverUsername)) throw new RuntimeException("Unauthorized");
        if (!"PENDING".equals(room.getStatus())) throw new RuntimeException("Room already accepted");

        room.setHashedReceiverPin(passwordEncoder.encode(rawPin));
        room.setStatus("ACCEPTED");
        darkRoomRoomRepository.save(room);
        return mapToDto(room);
    }

    public DarkRoomRoomDto finalizeRoom(UUID roomId, String initiatorUsername, String rawPin) {
        DarkRoomRoom room = darkRoomRoomRepository.findById(roomId).orElseThrow();
        if (!room.getInitiator().getUsername().equals(initiatorUsername)) throw new RuntimeException("Unauthorized");
        if (!"ACCEPTED".equals(room.getStatus())) throw new RuntimeException("Room must be accepted by receiver first");

        room.setHashedInitiatorPin(passwordEncoder.encode(rawPin));
        room.setStatus("READY");
        darkRoomRoomRepository.save(room);
        return mapToDto(room);
    }

    public boolean insertKey(UUID roomId, String username, String rawPin) {
        DarkRoomRoom room = darkRoomRoomRepository.findById(roomId).orElseThrow();
        if (!"READY".equals(room.getStatus())) throw new RuntimeException("Room is not ready for dual-key unlock.");

        boolean valid = false;
        if (room.getInitiator().getUsername().equals(username)) {
            valid = passwordEncoder.matches(rawPin, room.getHashedInitiatorPin());
        } else if (room.getReceiver().getUsername().equals(username)) {
            valid = passwordEncoder.matches(rawPin, room.getHashedReceiverPin());
        }

        if (!valid) throw new RuntimeException("Invalid PIN key.");

        activeKeys.computeIfAbsent(roomId, k -> ConcurrentHashMap.newKeySet()).add(username);
        return true;
    }

    public boolean areBothKeysInserted(UUID roomId) {
        Set<String> keys = activeKeys.get(roomId);
        return keys != null && keys.size() == 2;
    }

    public void removeKey(UUID roomId, String username) {
        Set<String> keys = activeKeys.get(roomId);
        if (keys != null) keys.remove(username);
    }
    
    // Used by WebSocketEventListener
    public void wipeUserAttemptByUsername(String username) {
        for (Map.Entry<UUID, Set<String>> entry : activeKeys.entrySet()) {
            if (entry.getValue().contains(username)) {
                entry.getValue().remove(username);
                // System needs to broadcast collapse...
                // That's handled via the controller mapping or active observer, 
                // but since it's a dead man switch on disconnect:
                entry.getValue().clear(); // Forcibly wipe the whole room state!
            }
        }
    }

    public void forceCollapseRoom(UUID roomId) {
        activeKeys.remove(roomId);
    }

    @org.springframework.transaction.annotation.Transactional
    public void reportTrustIssue(UUID roomId, String reporterUsername) {
        DarkRoomRoom room = darkRoomRoomRepository.findById(roomId).orElseThrow();
        if (!room.getInitiator().getUsername().equals(reporterUsername) && !room.getReceiver().getUsername().equals(reporterUsername)) {
            throw new RuntimeException("Unauthorized");
        }
        User peer = room.getInitiator().getUsername().equals(reporterUsername) ? room.getReceiver() : room.getInitiator();
        
        peer.setTrustBreakCount(peer.getTrustBreakCount() + 1);
        userRepository.save(peer);
        
        // Manual wipe required due to DB foreign key constraints blocking direct room deletion
        darkRoomMessageRepository.deleteByDarkRoom(room);
        darkRoomMessageRepository.flush();
        darkRoomRoomRepository.deleteById(roomId);
        darkRoomRoomRepository.flush();
        
        forceCollapseRoom(roomId);
    }

    public List<DarkRoomRoomDto> getUserRooms(String username) {
        User u = userRepository.findByUsername(username).orElseThrow();
        return darkRoomRoomRepository.findAllByUser(u).stream().map(this::mapToDto).collect(Collectors.toList());
    }

    private DarkRoomRoomDto mapToDto(DarkRoomRoom room) {
        return DarkRoomRoomDto.builder()
                .id(room.getId())
                .initiatorUsername(room.getInitiator().getUsername())
                .receiverUsername(room.getReceiver().getUsername())
                .status(room.getStatus())
                .build();
    }

    public ChatMessageResponse saveMessage(UUID roomId, String username, String content, com.securechat.backend.enums.MessageType type) {
        DarkRoomRoom room = darkRoomRoomRepository.findById(roomId).orElseThrow();
        if (!areBothKeysInserted(roomId)) {
             throw new RuntimeException("Room collapsed or not unlocked");
        }

        User sender = userRepository.findByUsername(username).orElseThrow();
        DarkRoomMessage msg = DarkRoomMessage.builder()
                .darkRoom(room)
                .sender(sender)
                .content(content)
                .messageType(type != null ? type : com.securechat.backend.enums.MessageType.TEXT)
                .build();
        darkRoomMessageRepository.save(msg);
        return mapMsgToDto(msg, roomId);
    }

    public List<ChatMessageResponse> getMessages(UUID roomId) {
        DarkRoomRoom room = darkRoomRoomRepository.findById(roomId).orElseThrow();
        return darkRoomMessageRepository.findByDarkRoomOrderByCreatedAtAsc(room).stream()
                .map(msg -> mapMsgToDto(msg, roomId)).collect(Collectors.toList());
    }

    private ChatMessageResponse mapMsgToDto(DarkRoomMessage msg, UUID roomId) {
        return ChatMessageResponse.builder()
                .id(msg.getId())
                .chatRequestId(roomId)
                .senderUsername(msg.getSender().getUsername())
                .content(msg.getContent())
                .messageType(msg.getMessageType())
                .status(com.securechat.backend.enums.MessageStatus.DELIVERED)
                .createdAt(msg.getCreatedAt())
                .build();
    }
}
