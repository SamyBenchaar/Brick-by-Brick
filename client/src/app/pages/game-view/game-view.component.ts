import { CommonModule } from '@angular/common';
import { Component, computed, effect, ElementRef, HostListener, inject, Injector, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { ChatComponent } from '@app/components/chat/chat.component';
import { AppDialogComponent } from '@app/components/game-edition-components/app-dialog/app-dialog.component';
import { GameGridComponent } from '@app/components/game-edition-components/game-grid/game-grid.component';
import { PlayerBoardComponent } from '@app/components/game-view-components/player-board/player-board/player-board.component';
import { PlayerSignComponent } from '@app/components/game-view-components/player-sign/player-sign/player-sign.component';
import { AVATARS } from '@app/constants/character-constants';
import { KEY_DEBUG, KEY_DIRECTION_MAP, KEY_ENTER } from '@common/constants/key-event.constants';
import { AppDialogData } from '@app/interfaces/dialog-model';
import { Game } from '@app/interfaces/game';
import { Tile } from '@app/classes/tile/tile';
import { GamePlaySocketService } from '@app/services/communication/game-session-socket/game-play-socket.service';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';
import { Character } from '@common/character';
import { getGameSizeConfig } from '@common/constants/game-config-constants';
import { MapSize, ObjectType } from '@common/map';
import { Position } from '@common/position';
import { Subscription } from 'rxjs';
import { CombatViewComponent } from '@app/components/game-view-components/combat-view/combat-view.component';
import { CombatSocketService } from '@app/services/communication/game-session-socket/combat-socket.service';

@Component({
  selector: 'app-game-view',
  imports: [CommonModule, GameGridComponent, ChatComponent, PlayerBoardComponent, PlayerSignComponent, CombatViewComponent],
  templateUrl: './game-view.component.html',
  styleUrl: './game-view.component.scss',
})
export class GameViewComponent implements OnInit, OnDestroy {
  gameSessionSocketService = inject(GameSessionSocketService);
  gamePlaySocketService = inject(GamePlaySocketService);
  combatSocketService = inject(CombatSocketService);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private injector = inject(Injector);
  private routeSubscription?: Subscription;

  @ViewChild('chatSidebar') chatSidebar!: ElementRef<HTMLElement>;

  gameData: Game | null = null;
  isChatCollapsed = false;
  isActionSelectionMode = signal<boolean>(false);

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
  currentPlayerTurn = computed(() => this.gamePlaySocketService.currentPlayerTurn());
  isDebugModeActivated = computed(() => this.gamePlaySocketService.isDebugModeActivated());

  displayedTurnTimer = computed(() => {
    const activeCombat = this.combatSocketService.activeCombat();
    if (!activeCombat) {
      return `${this.getTurnTimeRemaining()}s`;
    }

    if (!this.combatSocketService.isCurrentUserInCombat()) {
      return '--';
    }

    const combatTime = this.combatSocketService.combatTurnTimeRemaining();
    return combatTime === null ? '--' : `${combatTime}s`;
  });

  combatNotification = computed(() => this.combatSocketService.combatNotification());

  closeCombatNotification(): void {
    this.combatSocketService.clearCombatNotification();
  }

  ngOnInit(): void {
    if (!this.gameSessionSocketService.currentSession() || !this.gamePlaySocketService.mapCopy()) {
      this.router.navigate(['/']);
      return;
    }

    effect(() => {
      const map = this.gamePlaySocketService.mapCopy();
      this.gameData = map ? JSON.parse(JSON.stringify(map)) : null;
    }, { injector: this.injector });

    effect(() => {
      const activeCombat = this.combatSocketService.activeCombat();
      this.gameSessionSocketService.currentSession();
      this.gamePlaySocketService.currentPlayerTurn();

      if (activeCombat) {
        this.isActionSelectionMode.set(false);
        return;
      }

      if (!this.gamePlaySocketService.canCurrentPlayerAttack()) {
        this.isActionSelectionMode.set(false);
      }
    }, { injector: this.injector });

    window.addEventListener('beforeunload', this.handleBeforeUnload);
    window.addEventListener('popstate', this.handleBackButton);
  }

  @HostListener('window:keyup', ['$event'])
  handleKeyUp(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();

    if (key === KEY_ENTER && this.isWriting()) {
      this.isWriting.set(false);
      return;
    }

    if (key === KEY_DEBUG && this.gameSessionSocketService.isCurrentUserHost() && !this.isWriting()) {
      this.gamePlaySocketService.toggleDebugMode();
      return;
    }

    if (!this.isMyTurn() || this.isWriting() || this.combatSocketService.activeCombat() || this.dialog.openDialogs.length > 0) return;
    const direction = KEY_DIRECTION_MAP[key];

    if (direction) {
      this.gamePlaySocketService.requestMove(direction);
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

  handleBackButton = (): void => {
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
    return this.gamePlaySocketService.isMyTurn();
  }

  isHost(): boolean {
    return this.gameSessionSocketService.isCurrentUserHost();
  }

  isInCombat(): boolean {
    return this.combatSocketService.isCurrentUserInCombat();
  }

  getCurrentTurnPlayerName(): string {
    const currentPlayerId = this.gamePlaySocketService.currentPlayerTurn();
    const player = this.gameSessionSocketService.currentSession()?.players.find(p => p.character.id === currentPlayerId);
    return player?.character.name ?? '';
  }

  getTurnTimeRemaining(): number {
    return this.gamePlaySocketService.turnTimeRemaining();
  }

  getInterTurnTimeRemaining(): number {
    return this.gamePlaySocketService.interTurnTimeRemaining();
  }

  isTurnStarting(): boolean {
    return this.gamePlaySocketService.turnStarting();
  }

  endTurn(): void {
    this.gamePlaySocketService.endTurn();
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

  getSelectedTarget(): string | null {
    return this.isActionSelectionMode() ? 'une cible' : null;
  }

  canAttackSelectedTarget(): boolean {
    return this.gamePlaySocketService.canCurrentPlayerAttack();
  }

  canInteract(): boolean {
    return this.gamePlaySocketService.canPlayerInteractDoor() || this.gamePlaySocketService.canPlayerInteractSanctuary();
  }

  onActionClick(): void {
    this.isActionSelectionMode.set(true);

  }

  onActionTargetSelected(event: {tile: Tile, position: Position}): void {
    if (!this.gamePlaySocketService.canInteractWithTarget(event.tile, event.position)) return;
    
    const isSanctuary = event.tile.object === ObjectType.HealingSanctuary || event.tile.object === ObjectType.CombatSanctuary;
    if (isSanctuary) {
      const ref = this.dialog.open(AppDialogComponent, {
        id: 'sanctuary-dialog',
        data: {
            title: event.tile.object === ObjectType.HealingSanctuary
                ? 'Sanctuaire de soin' : 'Sanctuaire de combat',
            message: 'Choisissez votre mode d\'interaction.',
            type: 'info',
            confirmText: 'Normal',
            cancelText: 'Double ou rien',
            thirdOptionText: 'Annuler',
        },
    });
    ref.afterClosed().subscribe((result) => {
        if (result === true) this.gamePlaySocketService.requestInteract(event.position, 'normal');
        else if (result === false) this.gamePlaySocketService.requestInteract(event.position, 'double');
    });
    this.isActionSelectionMode.set(false);
    return;
    }
    this.gamePlaySocketService.requestInteract(event.position, 'normal');
    this.isActionSelectionMode.set(false);
  }

  onAttackTargetSelected(target: Character): void {
    if (this.gamePlaySocketService.canTransferFlagTo(target)) {
      this.gamePlaySocketService.requestFlagTransfer(target.id);
      this.isActionSelectionMode.set(false);
      return;
    }

    if (!this.gamePlaySocketService.canAttackTarget(target)) {
      return;
    }

    this.gamePlaySocketService.requestCombat(target.id);
    this.isActionSelectionMode.set(false);
  }

  getAvatarImage(avatarId: number): string {
    return AVATARS.find(a => a.id === avatarId)?.image ?? 'assets/images/lily.jpg';
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    window.removeEventListener('popstate', this.handleBackButton);
  }
  leaveGameSession(): void {
    this.gameSessionSocketService.leaveGameSession();
    this.router.navigate(['/home']);
  }
}
