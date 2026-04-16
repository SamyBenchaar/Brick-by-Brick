import { LogGateway } from '@app/gateways/log/log.gateway';
import { LogOptions } from '@app/interfaces/log-options';
import { LogMessage } from '@common/message';
import { Injectable } from '@nestjs/common';

@Injectable()
export class LogService {
    constructor(private readonly logGateway: LogGateway) {}

    log(roomId: string, content: string, options: LogOptions = {}): void {
        const { type = 'global', playersInvolved } = options;
        const logMessage: Omit<LogMessage, '_id'> = {
            timestamp: new Date(),
            type,
            content,
            playersInvolved,
        };

        this.logGateway.sendLogMessage(roomId, logMessage);
    }
}