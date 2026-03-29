package com.securechat.backend.dto;

import lombok.Builder;
import lombok.Data;
import java.util.UUID;

@Data
@Builder
public class UserProfileDto {
    private UUID id;
    private String username;
    private String firstName;
    private String lastName;
    private String gender;
    private String dob;
    private String email;
    private String mobileNumber;
    private String profilePicture;
    private boolean profilePhotoPublic;
    private boolean allowIncomingRequests;
    private int trustBreakCount;
    private int successfulConnectionsCount;
}
