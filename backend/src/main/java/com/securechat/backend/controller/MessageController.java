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
        return ResponseEntity.ok(messageService.getMessages(chatRequestId, authentication.getName()));
    }
}
