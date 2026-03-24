package com.securechat.backend.dto;

import com.securechat.backend.enums.MessageStatus;
import com.securechat.backend.enums.MessageType;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class ChatMessageResponse {
    private UUID id;
    private UUID chatRequestId;
    private String senderUsername;
    private String content;
    private MessageType messageType;
    private MessageStatus status;
    private Integer evaporateTime;
    private LocalDateTime createdAt;
}
