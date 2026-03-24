package com.securechat.backend.controller;

import com.securechat.backend.dto.ChatRequestDto;
import com.securechat.backend.service.ChatRequestService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/requests")
@RequiredArgsConstructor
public class ChatRequestController {

    private final ChatRequestService chatRequestService;

    @PostMapping("/send")
    public ResponseEntity<ChatRequestDto> sendRequest(Authentication authentication, @RequestBody Map<String, String> body) {
        String senderUsername = authentication.getName();
        String receiverUsername = body.get("receiverUsername");
        return ResponseEntity.ok(chatRequestService.sendRequest(senderUsername, receiverUsername));
    }

    @GetMapping("/pending")
    public ResponseEntity<List<ChatRequestDto>> getPendingRequests(Authentication authentication) {
        String receiverUsername = authentication.getName();
        return ResponseEntity.ok(chatRequestService.getPendingRequests(receiverUsername));
    }

    @GetMapping("/active")
    public ResponseEntity<List<ChatRequestDto>> getActiveChats(Authentication authentication) {
        return ResponseEntity.ok(chatRequestService.getActiveChats(authentication.getName()));
    }

    @PostMapping("/{requestId}/accept")
    public ResponseEntity<ChatRequestDto> acceptRequest(Authentication authentication, @PathVariable UUID requestId) {
        String receiverUsername = authentication.getName();
        return ResponseEntity.ok(chatRequestService.acceptRequest(requestId, receiverUsername));
    }

    @PostMapping("/{requestId}/reject")
    public ResponseEntity<ChatRequestDto> rejectRequest(Authentication authentication, @PathVariable UUID requestId) {
        String receiverUsername = authentication.getName();
        return ResponseEntity.ok(chatRequestService.rejectRequest(requestId, receiverUsername));
    }
}
