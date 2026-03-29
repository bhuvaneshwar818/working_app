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

    @GetMapping("/sent")
    public ResponseEntity<List<ChatRequestDto>> getSentRequests(Authentication authentication) {
        String senderUsername = authentication.getName();
        return ResponseEntity.ok(chatRequestService.getSentRequests(senderUsername));
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

    @DeleteMapping("/{requestId}/trust-issue")
    public ResponseEntity<?> reportTrustIssue(Authentication authentication, @PathVariable UUID requestId) {
        chatRequestService.reportTrustIssue(requestId, authentication.getName());
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{requestId}")
    public ResponseEntity<?> deleteConnection(Authentication authentication, @PathVariable UUID requestId) {
        chatRequestService.deleteConnection(requestId, authentication.getName());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{requestId}/pin")
    public ResponseEntity<?> togglePin(Authentication authentication, @PathVariable UUID requestId) {
        chatRequestService.togglePin(requestId, authentication.getName());
        return ResponseEntity.ok().build();
    }
}
