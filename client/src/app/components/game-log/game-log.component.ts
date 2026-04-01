import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { LogMessage } from '@common/message';

@Component({
  selector: 'app-game-log',
  imports: [CommonModule],
  templateUrl: './game-log.component.html',
  styleUrl: './game-log.component.scss',
})
export class GameLogComponent {
  @Input() logs: LogMessage[] = [];
  filteredLogs: LogMessage[] = [];
  
}
