package com.securechat.backend.controller;

import com.securechat.backend.dto.DarkRoomRoomDto;
import com.securechat.backend.service.DarkRoomService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/darkroom")
@RequiredArgsConstructor
public class DarkRoomController {

    private final DarkRoomService darkRoomService;
    private final SimpMessagingTemplate messagingTemplate;

    @PostMapping("/request")
    public ResponseEntity<DarkRoomRoomDto> requestRoom(Authentication auth, @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(darkRoomService.requestRoom(auth.getName(), body.get("receiverUsername")));
    }

    @PostMapping("/accept/{roomId}")
    public ResponseEntity<DarkRoomRoomDto> acceptRoom(Authentication auth, @PathVariable UUID roomId, @RequestBody Map<String, String> body) {
        DarkRoomRoomDto response = darkRoomService.acceptRoom(roomId, auth.getName(), body.get("pin"));
        messagingTemplate.convertAndSendToUser(response.getInitiatorUsername(), "/queue/darkroom-status", "ACCEPTED");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/finalize/{roomId}")
    public ResponseEntity<DarkRoomRoomDto> finalizeRoom(Authentication auth, @PathVariable UUID roomId, @RequestBody Map<String, String> body) {
        DarkRoomRoomDto response = darkRoomService.finalizeRoom(roomId, auth.getName(), body.get("pin"));
        messagingTemplate.convertAndSendToUser(response.getReceiverUsername(), "/queue/darkroom-status", "READY");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/mine")
    public ResponseEntity<List<DarkRoomRoomDto>> getMyRooms(Authentication auth) {
        return ResponseEntity.ok(darkRoomService.getUserRooms(auth.getName()));
    }

    @PostMapping("/insert-key/{roomId}")
    public ResponseEntity<?> insertKey(Authentication auth, @PathVariable UUID roomId, @RequestBody Map<String, String> body) {
        String username = auth.getName();
        darkRoomService.insertKey(roomId, username, body.get("pin"));
        
        if (darkRoomService.areBothKeysInserted(roomId)) {
            // BOTH injected! Broadcast to room
            messagingTemplate.convertAndSend("/topic/darkroom-status/" + roomId, "UNLOCKED");
            return ResponseEntity.ok(Map.of("status", "UNLOCKED", "messages", darkRoomService.getMessages(roomId)));
        } else {
            // Only 1 injected. Broadcast to room that one is waiting.
            messagingTemplate.convertAndSend("/topic/darkroom-status/" + roomId, "WAITING_FOR_PEER_" + username);
            return ResponseEntity.ok(Map.of("status", "WAITING"));
        }
    }
    
    @PostMapping("/pull-key/{roomId}")
    public ResponseEntity<?> pullKey(Authentication auth, @PathVariable UUID roomId) {
        darkRoomService.removeKey(roomId, auth.getName());
        messagingTemplate.convertAndSend("/topic/darkroom-status/" + roomId, "COLLAPSED");
        return ResponseEntity.ok().build();
    }

    @GetMapping("/messages/{roomId}")
    public ResponseEntity<List<?>> getMessages(Authentication auth, @PathVariable UUID roomId) {
        if (!darkRoomService.areBothKeysInserted(roomId)) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(darkRoomService.getMessages(roomId));
    }
}
