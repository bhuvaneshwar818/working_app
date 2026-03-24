package com.securechat.backend.controller;

import com.securechat.backend.dto.ChatMessageResponse;
import com.securechat.backend.dto.DarkRoomMessageDto;
import com.securechat.backend.dto.MessageDto;
import com.securechat.backend.service.DarkRoomService;
import com.securechat.backend.service.MessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;

import java.time.LocalDateTime;

@Controller
@RequiredArgsConstructor
public class ChatController {

    private final MessageService messageService;
    private final DarkRoomService darkRoomService;
    private final SimpMessagingTemplate messagingTemplate;

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
        ChatMessageResponse response = darkRoomService.saveMessage(java.util.UUID.fromString(messageDto.getRoomId()), senderUsername, messageDto.getContent(), messageDto.getType());
        messagingTemplate.convertAndSend("/topic/darkroom/" + messageDto.getRoomId(), response);
    }

    @MessageMapping("/evaporator.sendMessage")
    public void sendEvaporatorMessage(@Payload DarkRoomMessageDto messageDto, Authentication authentication) {
        String senderUsername = authentication.getName();
        
        ChatMessageResponse ephemeralResponse = ChatMessageResponse.builder()
                .id(messageDto.getId() != null ? java.util.UUID.fromString(java.util.UUID.nameUUIDFromBytes(messageDto.getId().getBytes()).toString()) : java.util.UUID.randomUUID())
                .chatRequestId(null)
                .senderUsername(senderUsername)
                .content(messageDto.getContent())
                .messageType(messageDto.getType() != null ? messageDto.getType() : com.securechat.backend.enums.MessageType.TEXT)
                .status(com.securechat.backend.enums.MessageStatus.DELIVERED)
                .createdAt(LocalDateTime.now())
                .build();

        messagingTemplate.convertAndSend("/topic/evaporator/" + messageDto.getRoomId(), ephemeralResponse);
    }
}
