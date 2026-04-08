import { CommonModule } from '@angular/common';
import { Component, computed, inject, Input, OnDestroy, OnInit } from '@angular/core';
import { LogService } from '@app/services/communication/log/log.service';

@Component({
  selector: 'app-game-log',
  imports: [CommonModule],
  templateUrl: './game-log.component.html',
  styleUrl: './game-log.component.scss',
})
export class GameLogComponent implements OnInit, OnDestroy {
  @Input() gameId?: string;
  @Input() username: string;
  private logService = inject(LogService);
  logs = this.logService.logs;
  
  filteredLogs = computed(() => {    
    return this.logs().filter(log =>
        log.type === 'global' ||
        (log.type === 'combat' && log.playersInvolved?.includes(this.username)),
    );
});

  ngOnInit() {
    const roomId = this.gameId || 'waiting-room';
    this.logService.connect(roomId);
  }

  ngOnDestroy() {
    this.logService.disconnect();
  }
  
}
