package com.securechat.backend.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class UserPublicProfileDto {
    private String username;
    private String profilePicture;
    private boolean allowIncomingRequests;
    private int trustBreakCount;
    private int successfulConnectionsCount;
}
