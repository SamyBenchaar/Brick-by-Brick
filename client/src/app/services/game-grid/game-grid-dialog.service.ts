import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Tile } from '@app/classes/tile/tile';
import { AppDialogComponent } from '@app/components/game-edition-components/app-dialog/app-dialog.component';
import { DialogType } from '@app/constants/dialog-type.enum';
import { GameSession } from '@app/interfaces/game-session';
import { FlagTransferSocketService } from '@app/services/communication/game-session-socket/flag-transfer-socket.service';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';
import { GameGridHelperService } from '@app/services/game-grid/game-grid-helper.service';
import { Character } from '@common/character';
import { GameModeValue } from '@common/constants/game-config-constants';

@Injectable({
    providedIn: 'root',
})
export class GameGridDialogService {
    private dialog = inject(MatDialog);
    private gameSessionSocketService = inject(GameSessionSocketService);
    private gameGridHelperService = inject(GameGridHelperService);
    private flagTransferService = inject(FlagTransferSocketService);

    openPlayerDialog(player: Character): void {
        const session = this.gameSessionSocketService.currentSession();
        const currentPlayer = this.gameGridHelperService.getCurrentPlayer();
        const isCtfMode = session?.gameMode === GameModeValue.Ctf;

        if (isCtfMode && currentPlayer && this.shouldShowFlagTransferDialog(player, currentPlayer, session)) {
            this.showFlagTransferDialog(player, currentPlayer);
            return;
        }

        this.showPlayerInfoDialog(player);
    }

    private shouldShowFlagTransferDialog(
        targetPlayer: Character,
        currentPlayer: Character,
        session: GameSession | null,
    ): boolean {
        const currentPlayerTeam = (session?.playerTeams as Record<string, string> | undefined)?.[currentPlayer.id];
        const targetPlayerTeam = (session?.playerTeams as Record<string, string> | undefined)?.[targetPlayer.id];
        const isTeammate = currentPlayerTeam === targetPlayerTeam && !!currentPlayerTeam;
        return isTeammate && currentPlayer.id !== targetPlayer.id;
    }

    private showFlagTransferDialog(targetPlayer: Character, currentPlayer: Character): void {
        const canTransferFlag = currentPlayer.hasFlag;
        const canRequestFlag = !currentPlayer.hasFlag && targetPlayer.hasFlag;

        if (!canTransferFlag && !canRequestFlag) {
            this.showPlayerInfoDialog(targetPlayer);
            return;
        }

        let message = `Interaction avec ${targetPlayer.name}:\n\n`;
        if (canTransferFlag) {
            message += `✓ Vous pouvez offrir le drapeau à ${targetPlayer.name}`;
        } else if (canRequestFlag) {
            message += `✓ Vous pouvez demander le drapeau à ${targetPlayer.name}`;
        } else {
            message += `Aucune action de drapeau disponible`;
        }

        this.flagTransferService.isFlagTransferModalOpen.set(true);
        const dialogRef = this.dialog.open(AppDialogComponent, {
            data: {
                title: 'Transfert de drapeau',
                message: message.trim(),
                type: DialogType.INFO,
                confirmText: canTransferFlag ? 'Offrir' : 'Demander',
                cancelText: 'Annuler',
            },
        });

        dialogRef.afterClosed().subscribe((accepted) => {
            this.flagTransferService.isFlagTransferModalOpen.set(false);
            if (accepted ) {
                this.gameSessionSocketService.requestFlagTransfer(targetPlayer.id);
            }
        });
    }

    private showPlayerInfoDialog(player: Character): void {
        this.dialog.open(AppDialogComponent, {
            data: {
                title: 'Informations du joueur',
                message: `Joueur: ${player.name}\nVictoires: ${player.victories}`,
                type: DialogType.INFO,
            },
        });
    }

    openTileDialog(tile: Tile): void {
        this.dialog.open(AppDialogComponent, {
            data: {
                title: 'Informations de la tuile',
                message: `Type: ${tile.type}\nCoût: ${this.gameGridHelperService.getTileCost(tile.type)}`,
                type: DialogType.INFO,
            },
        });
    }
}
