package com.securechat.backend.dto;

import com.securechat.backend.enums.RequestStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class ChatRequestDto {
    private UUID id;
    private String senderUsername;
    private String receiverUsername;
    private RequestStatus status;
    private LocalDateTime createdAt;
    private Long unreadCount;
}
