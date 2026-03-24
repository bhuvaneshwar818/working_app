package com.securechat.backend.dto;

import com.securechat.backend.enums.MessageType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageDto {
    private UUID chatRequestId;
    private String content;
    private MessageType type;
    private Integer evaporateTime;
}
