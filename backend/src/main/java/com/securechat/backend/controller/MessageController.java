package com.securechat.backend.controller;

import com.securechat.backend.dto.ChatMessageResponse;
import com.securechat.backend.service.MessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
public class MessageController {

    private final MessageService messageService;

    @GetMapping("/{chatRequestId}")
    public ResponseEntity<List<ChatMessageResponse>> getMessages(Authentication authentication, @PathVariable UUID chatRequestId) {
        System.out.println("DEBUG: GET /api/messages/" + chatRequestId + " from user: " + authentication.getName());
        return ResponseEntity.ok(messageService.getMessages(chatRequestId, authentication.getName()));
    }

    @PostMapping("/{chatRequestId}/wipe-seen")
    public ResponseEntity<?> wipeSeen(Authentication auth, @PathVariable UUID chatRequestId) {
        messageService.wipeSeenMessages(chatRequestId);
        return ResponseEntity.ok().build();
    }
}
