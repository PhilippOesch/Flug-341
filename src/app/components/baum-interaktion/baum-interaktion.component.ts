import { Component, OnInit, Input, SimpleChanges, OnChanges, EventEmitter, Output} from '@angular/core';

@Component({
  selector: 'app-baum-interaktion',
  templateUrl: './baum-interaktion.component.html',
  styleUrls: ['./baum-interaktion.component.scss'],
})
export class BaumInteraktionComponent implements OnInit, OnChanges {
  @Input() heading;
  @Input() initheading;

  @Output() clickHandler : EventEmitter<any> = new EventEmitter();

  isActive=false;

  constructor() { }

  ngOnInit() {

  }

  onclickHandler(){
    if(this.isActive){
      this.clickHandler.emit();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    
    let direction= (this.heading-this.initheading)% 360;
    if((direction+5)>90 && (direction-5)<90 ){
      this.isActive= true;
    } else {
      this.isActive= false;
    }
  }
}
