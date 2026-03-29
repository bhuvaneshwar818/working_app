package com.securechat.backend.controller;

import com.securechat.backend.dto.ChatMessageResponse;
import com.securechat.backend.dto.DarkRoomMessageDto;
import com.securechat.backend.dto.MessageDto;
import com.securechat.backend.service.DarkRoomService;
import com.securechat.backend.service.MessageService;
import com.securechat.backend.service.EvaporatorService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;

import java.util.UUID;

@Controller
@RequiredArgsConstructor
public class ChatController {

    private final MessageService messageService;
    private final DarkRoomService darkRoomService;
    private final SimpMessagingTemplate messagingTemplate;
    private final EvaporatorService evaporatorService;

    @MessageMapping("/chat.sendMessage")
    public void sendMessage(@Payload MessageDto messageDto, Authentication authentication) {
        String senderUsername = authentication.getName();
        ChatMessageResponse response = messageService.saveMessage(senderUsername, messageDto);
        messagingTemplate.convertAndSend("/topic/chat/" + messageDto.getChatRequestId(), response);
    }

    @MessageMapping("/chat.markRead")
    public void markRead(@Payload com.securechat.backend.dto.MarkReadDto dto, Authentication authentication) {
        String username = authentication.getName();
        messageService.markAllAsRead(dto.getChatRequestId(), username);
    }

    @MessageMapping("/darkroom.sendMessage")
    public void sendDarkRoomMessage(@Payload DarkRoomMessageDto messageDto, Authentication authentication) {
        String senderUsername = authentication.getName();
        ChatMessageResponse response = darkRoomService.saveMessage(UUID.fromString(messageDto.getRoomId()), senderUsername, messageDto.getContent(), messageDto.getType());
        messagingTemplate.convertAndSend("/topic/darkroom/" + messageDto.getRoomId(), response);
    }

    @MessageMapping("/evaporator.sendMessage")
    public void sendEvaporatorMessage(@Payload DarkRoomMessageDto messageDto, Authentication authentication) {
        String senderUsername = authentication.getName();
        
        // Finalize recipient name from Room ID (userA-evap-userB)
        String recipient = "";
        try {
            String[] parts = messageDto.getRoomId().split("-evap-");
            if (parts.length == 2) {
                recipient = parts[0].equals(senderUsername) ? parts[1] : parts[0];
            }
        } catch (Exception e) {}

        if (recipient.isEmpty()) return;

        // 1. Physically isolate then store in separate DB table until seen
        ChatMessageResponse savedResponse = evaporatorService.saveMessage(
            senderUsername, 
            recipient, 
            messageDto.getContent(), 
            messageDto.getType() != null ? messageDto.getType() : com.securechat.backend.enums.MessageType.TEXT,
            messageDto.getEvaporateTime()
        );

        // 2. Broadcast to CURRENT session (sender & receiver if joined)
        messagingTemplate.convertAndSend("/topic/evaporator/" + messageDto.getRoomId(), savedResponse);
    }
}
