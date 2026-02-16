import {overlay} from "./uiOverlay.js";

export class DeathScene{

update(){}

draw(ctx){
overlay(ctx,320,180,"YOU DIED","CLICK TO RESTART");
}

}
