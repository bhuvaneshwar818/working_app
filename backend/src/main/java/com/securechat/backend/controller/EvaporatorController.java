package com.securechat.backend.controller;

import com.securechat.backend.dto.ChatMessageResponse;
import com.securechat.backend.service.EvaporatorService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/evaporator")
@RequiredArgsConstructor
public class EvaporatorController {

    private final EvaporatorService evaporatorService;

    @GetMapping("/messages/{peer}")
    public ResponseEntity<List<ChatMessageResponse>> getMessages(@PathVariable String peer, Authentication authentication) {
        String username = authentication.getName();
        // Fetch from separate DB table and ATOMICALLY delete immediately
        List<ChatMessageResponse> messages = evaporatorService.getMessagesAndVaporize(username, peer);
        return ResponseEntity.ok(messages);
    }

    @GetMapping("/unread-senders-count")
    public ResponseEntity<Long> getUnreadSendersCount(Authentication authentication) {
        String username = authentication.getName();
        return ResponseEntity.ok(evaporatorService.getUnreadSendersCount(username));
    }

    @GetMapping("/unread-counts")
    public ResponseEntity<java.util.Map<String, Long>> getUnreadCountsPerSender(Authentication authentication) {
        String username = authentication.getName();
        return ResponseEntity.ok(evaporatorService.getUnreadCountsPerSender(username));
    }
}
