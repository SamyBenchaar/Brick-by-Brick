import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
// import { CommunicationService } from '@app/services/communication/communication.service';
import { Character, Dice } from '@app/interfaces/character-model';


@Component({
    selector: 'app-character-creation-page',
    templateUrl: './character-creation-page.component.html',
    styleUrls: ['./character-creation-page.component.scss'],
    imports: [],
})

export class CharacterCreationPageComponent {
    private router = inject(Router);
    character: Character = this.createBaseCharacter();
    bonusTarget: 'life' | 'speed' | null = null;

    createBaseCharacter(): Character {
        return {
            name: '',
            avatarId: 1,
            life: 6,
            speed: 6,
            attack: 4,
            defense: 4,
            attackDice: 'D6' as Dice,
            defenseDice: 'D6' as Dice,
        };
    }
    applyBonus(target: 'life' | 'speed') {
        this.character.life = 6;
        this.character.speed = 6;

        this.character[target] += 2;
        this.bonusTarget = target;
    }
    setDice(attribute: 'attackDice' | 'defenseDice', dice: Dice) {
        this.character[attribute] = dice;
    }

    close() {
        this.router.navigate(['/game-creation']);
    }
    // ajouter une methode pour creer un personnage aleatoire
    // ajouter une methode pour soumettre le character créé
}