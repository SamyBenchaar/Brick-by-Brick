import { CommonModule } from '@angular/common';
import { Component, inject, Input, OnDestroy, OnInit } from '@angular/core';
import { LogService } from '@app/services/communication/log/log.service';

@Component({
  selector: 'app-game-log',
  imports: [CommonModule],
  templateUrl: './game-log.component.html',
  styleUrl: './game-log.component.scss',
})
export class GameLogComponent implements OnInit, OnDestroy {
  @Input() gameId?: string;
  private logService = inject(LogService);
  logs = this.logService.logs;

  ngOnInit() {
    const roomId = this.gameId || 'waiting-room';
    this.logService.connect(roomId);
  }

  ngOnDestroy() {
    this.logService.disconnect();
  }
  
}
