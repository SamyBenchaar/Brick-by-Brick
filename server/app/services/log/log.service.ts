import { Injectable } from '@nestjs/common';
import { LogGateway } from '@app/gateways/log/log.gateway';
import { LogMessage } from '@common/message';

@Injectable()
export class LogService {
    constructor(private readonly logGateway: LogGateway) {}

    log(roomId: string, content: string, type: 'global' | 'combat' = 'global', playersInvolved?: string[]): void {
        const logMessage: Omit<LogMessage, '_id'> = {
            timestamp: new Date(),
            type,
            content,
            playersInvolved,
        };

        this.logGateway.sendLogMessage(roomId, logMessage);
    }
}