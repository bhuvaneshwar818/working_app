package com.securechat.backend.dto;

import lombok.Data;

@Data
public class DarkRoomJoinRequest {
    private String roomId;
    private String pinPart2;
}
