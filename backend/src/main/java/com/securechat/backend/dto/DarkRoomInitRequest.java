package com.securechat.backend.dto;

import lombok.Data;

@Data
public class DarkRoomInitRequest {
    private String receiverUsername;
    private String pinPart1;
}
