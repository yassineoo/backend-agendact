import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateMessageDto {
    @IsString()
    @IsNotEmpty()
    recipientId: string;

    @IsString()
    @IsNotEmpty()
    content: string;

    @IsOptional()
    @IsString()
    type?: 'text' | 'image';

    @IsOptional()
    images?: string[];
}

export class CreateConversationDto {
    @IsString()
    @IsNotEmpty()
    participantId: string;
}
