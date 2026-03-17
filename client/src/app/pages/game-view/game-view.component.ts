import { CommonModule } from '@angular/common';
import { Component, computed, effect, HostListener, inject, Injector, OnDestroy, OnInit, signal, ViewChild, ElementRef } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { ChatComponent } from '@app/components/chat/chat.component';
import { AppDialogComponent } from '@app/components/game-edition-components/app-dialog/app-dialog.component';
import { GameGridComponent } from '@app/components/game-edition-components/game-grid/game-grid.component';
import { PlayerBoardComponent } from '@app/components/game-view-components/player-board/player-board/player-board.component';
import { PlayerSignComponent } from '@app/components/game-view-components/player-sign/player-sign/player-sign.component';
import { AVATARS } from '@app/constants/character-constants';
import { AppDialogData } from '@app/interfaces/dialog-model';
import { Game } from '@app/interfaces/game';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket.service';
import { Character } from '@common/character';
import { getGameSizeConfig } from '@common/constants/game-config-constants';
import { MapSize } from '@common/map';
import { Subscription } from 'rxjs';
import { KEY_DIRECTION_MAP, KEY_DEBUG, KEY_ENTER } from '@app/constants/key-event.constants';

@Component({
  selector: 'app-game-view',
  imports: [CommonModule, GameGridComponent, ChatComponent, PlayerBoardComponent, PlayerSignComponent],
  templateUrl: './game-view.component.html',
  styleUrl: './game-view.component.scss',
})
export class GameViewComponent implements OnInit, OnDestroy {
  gameSessionSocketService = inject(GameSessionSocketService);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private injector = inject(Injector);
  private routeSubscription?: Subscription;

  @ViewChild('chatSidebar') chatSidebar!: ElementRef<HTMLElement>;

  gameData: Game | null = null;
  isChatCollapsed = false;
  isAttackSelectionMode = signal<boolean>(false);

  isWriting = signal<boolean>(false);

  playerList = computed(() => this.gameSessionSocketService.currentSession()?.players ?? []);
  leftPlayerList = computed(() => this.gameSessionSocketService.currentSession()?.leftPlayers ?? []);
  hostPlayer = computed(() => this.gameSessionSocketService.currentSession()?.host);
  roomId = computed(() => this.gameSessionSocketService.currentSession()?.roomId || '');
  playerCount = computed(() => this.gameSessionSocketService.currentSession()?.players?.length ?? 0);
  currentPlayer = computed(() => {
    const socketId = this.gameSessionSocketService.getSocketId();
    return this.gameSessionSocketService.currentSession()?.players.find(p => p.socketId === socketId) ?? null;
  });
  isDebugModeActivated = computed(() => this.gameSessionSocketService.isDebugModeActivated());

  ngOnInit(): void {
    if (!this.gameSessionSocketService.currentSession() || !this.gameSessionSocketService.mapCopy()) {
      this.router.navigate(['/']);
      return;
    }

    effect(() => {
      const map = this.gameSessionSocketService.mapCopy();
      this.gameData = map ? JSON.parse(JSON.stringify(map)) : null;
    }, { injector: this.injector });

    effect(() => {
      this.gameSessionSocketService.currentSession();
      this.gameSessionSocketService.currentPlayerTurn();
      if (!this.gameSessionSocketService.canCurrentPlayerAttack()) {
        this.isAttackSelectionMode.set(false);
      }
    }, { injector: this.injector });

    window.addEventListener('beforeunload', this.handleBeforeUnload);
  }

  @HostListener('window:keyup', ['$event'])
  handleKeyUp(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();

    if (key === KEY_ENTER && this.isWriting()) {
      this.isWriting.set(false);
      return;
    }

    if (key === KEY_DEBUG && this.gameSessionSocketService.isCurrentUserHost() && !this.isWriting()) {
      this.gameSessionSocketService.toggleDebugMode();
      return;
    }

    if (!this.isMyTurn() || this.isWriting()) return;
      const direction = KEY_DIRECTION_MAP[key];

    if (direction) {
      this.gameSessionSocketService.requestMove(direction);
    }
  } 

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: MouseEvent): void {
    const chatSidebar = this.chatSidebar?.nativeElement;
    if (chatSidebar && !chatSidebar.contains(event.target as Node)) {
      this.isWriting.set(false);
    }
  }

  handleBeforeUnload = (): void => {
    this.gameSessionSocketService.abandonGame();
  };

 handleWritingChange(value: boolean): void {
    this.isWriting.set(value);
  }
  getMapSize(): MapSize {
    if (!this.gameData) {
      return MapSize.Small;
    }
    const config = getGameSizeConfig(this.gameData.mapConfig.size);
    return config.gridSize;
  }

  get hostId(): string {
    return this.gameSessionSocketService.hostSocketId() ?? '';
  }

  isMyTurn(): boolean {
    return this.gameSessionSocketService.isMyTurn();
  }

  isHost(): boolean {
    return this.gameSessionSocketService.isCurrentUserHost();
  }

  getCurrentTurnPlayerName(): string {
    const currentPlayerId = this.gameSessionSocketService.currentPlayerTurn();
    const player = this.gameSessionSocketService.currentSession()?.players.find(p => p.character.id === currentPlayerId);
    return player?.character.name ?? '';
  }

  getTurnTimeRemaining(): number {
    return this.gameSessionSocketService.turnTimeRemaining();
  }

  isTurnStarting(): boolean {
    return this.gameSessionSocketService.turnStarting();
  }

  endTurn(): void {
    this.gameSessionSocketService.endTurn();
  }

  abandonGame(): void {
    const dialogData: AppDialogData = {
      title: 'Abandon de la partie',
      message: 'Etes-vous sur de vouloir abandonner la partie?',
      type: 'warning',
      confirmText: 'Abandonner',
      cancelText: 'Annuler',
    };

    this.dialog.open(AppDialogComponent, {
      data: dialogData,
      disableClose: true,
    }).afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.gameSessionSocketService.abandonGame();
      }
    });
  }

  getPlayers(): Character[] {
    return this.gameSessionSocketService.currentSession()?.players.map(p => p.character) ?? [];
  }

  getSelectedAttackTargetName(): string | null {
    return this.isAttackSelectionMode() ? 'une cible' : null;
  }

  canAttackSelectedTarget(): boolean {
    return this.gameSessionSocketService.canCurrentPlayerAttack();
  }

  attackSelectedTarget(): void {
    if (!this.canAttackSelectedTarget()) {
      return;
    }
    this.isAttackSelectionMode.set(true);
  }

  onAttackTargetSelected(target: Character): void {
    if (!this.gameSessionSocketService.canAttackTarget(target)) {
      return;
    }

    this.gameSessionSocketService.requestCombat(target.id);
    this.isAttackSelectionMode.set(false);
  }

  getAvatarImage(avatarId: number): string {
    return AVATARS.find(a => a.id === avatarId)?.image ?? 'assets/images/lily.jpg';
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
  }
  leaveGameSession(): void {
    this.gameSessionSocketService.leaveGameSession();
    this.router.navigate(['/home']);
  }
}
