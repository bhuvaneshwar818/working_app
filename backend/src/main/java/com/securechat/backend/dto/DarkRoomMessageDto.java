package com.securechat.backend.dto;

import lombok.Data;

@Data
public class DarkRoomMessageDto {
    private String id; // Volatile temp ID
    private String roomId;
    private String content;
    private com.securechat.backend.enums.MessageType type;
    private Integer evaporateTime;
}
