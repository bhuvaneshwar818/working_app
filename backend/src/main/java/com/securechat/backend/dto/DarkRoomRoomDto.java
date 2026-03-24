package com.securechat.backend.dto;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class DarkRoomRoomDto {
    private UUID id;
    private String initiatorUsername;
    private String receiverUsername;
    private String status;
}
