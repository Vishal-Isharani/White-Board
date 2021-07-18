import { Component, OnInit } from '@angular/core';
import Konva from 'konva';
import { ShapeService } from '../shape.service';
import { TextNodeService } from '../text-node.service';
import { saveAs } from 'file-saver';

@Component({
  selector: 'app-whiteboard-page',
  templateUrl: './whiteboard-page.component.html',
  styleUrls: ['./whiteboard-page.component.scss'],
})
export class WhiteboardPageComponent implements OnInit {
  shapes: any = [];
  stage!: Konva.Stage;
  layer!: Konva.Layer;
  selectedButton: any = {
    circle: false,
    rectangle: false,
    line: false,
    undo: false,
    erase: false,
    text: false,
    json: false,
    exportImage: false,
    fromJson: false,
    addImage: false,
    clear: false,
  };
  selectedElement: Konva.Circle | Konva.Rect | Konva.Text | null = null;
  selectedElementType: 'Circle' | 'Rect' | 'Text' | null = null;
  erase: boolean = false;
  transformers: Konva.Transformer[] = [];
  fileUploadMode: 'json' | 'image' = 'json';
  colors: string[] = ['red', 'green', 'blue', 'yellow'];
  fontSize: number[] = [10, 12, 14, 16, 18, 20, 24];

  constructor(
    private shapeService: ShapeService,
    private textNodeService: TextNodeService
  ) {}

  ngOnInit() {
    let width = window.innerWidth * 0.8;
    let height = window.innerHeight;
    this.stage = new Konva.Stage({
      container: 'editor-container',
      width: width,
      height: height,
    });
    this.layer = new Konva.Layer();
    this.stage.add(this.layer);
    this.addLineListeners();
  }

  clearSelection() {
    Object.keys(this.selectedButton).forEach((key) => {
      this.selectedButton[key] = false;
    });
  }

  setSelection(type: string) {
    this.selectedButton[type] = true;
  }

  addShape(type: string) {
    this.clearSelection();
    this.setSelection(type);
    if (type == 'circle') {
      this.addCircle();
    } else if (type == 'line') {
      this.addLine();
    } else if (type == 'rectangle') {
      this.addRectangle();
    } else if (type == 'text') {
      this.addText();
    }
  }

  addText() {
    const text = this.textNodeService.textNode(this.stage, this.layer);
    this.shapes.push(text.textNode);
    this.layer.add(text.textNode);
    this.stage.add(this.layer);
    this.addTransformerListeners();

    text.textNode.on('dblclick dbltap', () => {
      // create textarea over canvas with absolute position

      // first we need to find position for textarea
      // how to find it?

      // at first lets find position of text node relative to the stage:
      var textPosition = text.textNode.getAbsolutePosition();

      // then lets find position of stage container on the page:
      var stageBox = this.stage.container().getBoundingClientRect();

      // so position of textarea will be the sum of positions above:
      var areaPosition = {
        x: stageBox.left + textPosition.x,
        y: stageBox.top + textPosition.y,
      };

      // create textarea and style it
      var textarea = document.createElement('textarea');
      document.body.appendChild(textarea);

      textarea.id = `text-area${text.textNode.getAttr('id')}`;
      textarea.value = text.textNode.text();
      textarea.style.position = 'absolute';
      textarea.style.top = areaPosition.y + 'px';
      textarea.style.left = areaPosition.x + 'px';
      textarea.style.width = text.textNode.width() + 'px';
      textarea.style.height = text.textNode.height() + 'px';

      textarea.focus();

      textarea.addEventListener('keydown', function (e) {
        // hide on enter
        if (e.keyCode === 13) {
          text.textNode.text(textarea.value);
          document.body.removeChild(textarea);
        }
      });
    });
  }

  addCircle() {
    const circle = this.shapeService.circle();
    this.shapes.push(circle);
    this.layer.add(circle);
    this.stage.add(this.layer);
    this.addTransformerListeners();
  }

  addRectangle() {
    const rectangle = this.shapeService.rectangle();
    this.shapes.push(rectangle);
    this.layer.add(rectangle);
    this.stage.add(this.layer);
    this.addTransformerListeners();
  }

  addLine() {
    this.selectedButton['line'] = true;
  }

  addLineListeners() {
    const component = this;
    let lastLine: any;
    let isPaint: any;
    this.stage.on('mousedown touchstart', function (e) {
      if (!component.selectedButton['line'] && !component.erase) {
        return;
      }
      isPaint = true;
      let pos = component.stage.getPointerPosition();
      const mode = component.erase ? 'erase' : 'brush';
      lastLine = component.shapeService.line(pos, mode);
      component.shapes.push(lastLine);
      component.layer.add(lastLine);
    });
    this.stage.on('mouseup touchend', function () {
      isPaint = false;
    });
    // and core function - drawing
    this.stage.on('mousemove touchmove', function () {
      if (!isPaint) {
        return;
      }
      const position: any = component.stage.getPointerPosition();
      var newPoints = lastLine.points().concat([position.x, position.y]);
      lastLine.points(newPoints);
      component.layer.batchDraw();
    });
  }

  undo() {
    const removedShape = this.shapes.pop();
    this.transformers.forEach((t) => {
      t.detach();
    });
    if (removedShape) {
      removedShape.remove();
    }
    this.layer.draw();
  }

  addTransformerListeners() {
    const component = this;
    const tr = new Konva.Transformer();
    this.stage.on('click', (e) => {
      if (!this.stage.clickStartShape) {
        return;
      }

      if (e.target._id == this.stage.clickStartShape._id) {
        component.addDeleteListener(e.target);
        component.layer.add(tr);
        tr.attachTo(e.target);
        component.transformers.push(tr);
        component.layer.draw();

        if (e.target instanceof Konva.Circle) {
          this.selectedElement = e.target;
          this.selectedElementType = 'Circle';
        } else if (e.target instanceof Konva.Rect) {
          this.selectedElement = e.target;
          this.selectedElementType = 'Rect';
        } else if (e.target instanceof Konva.Text) {
          this.selectedElement = e.target;
          this.selectedElementType = 'Text';
        }
      } else {
        // remove text area from text element
        this.stage.find('Text').each((textNode: any) => {
          const id = textNode.getAttr('id');
          const textAreaEl: HTMLTextAreaElement = document.getElementById(
            `text-area${id}`
          ) as HTMLTextAreaElement;
          if (textAreaEl) {
            textNode.text(textAreaEl.value);
            document.body.removeChild(textAreaEl);
          }
        });

        tr.detach();
        component.layer.draw();

        this.selectedElement = null;
      }
    });
  }

  addDeleteListener(shape: any) {
    const component = this;
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Delete') {
        shape.remove();
        component.transformers.forEach((t) => {
          t.detach();
        });
        const selectedShape = component.shapes.find(
          (s: any) => s._id == shape._id
        );
        selectedShape.remove();
        e.preventDefault();
      }
      component.layer.batchDraw();
    });
  }

  clearBoard() {
    let width = window.innerWidth * 0.8;
    let height = window.innerHeight;
    this.stage = new Konva.Stage({
      container: 'editor-container',
      width: width,
      height: height,
    });
    this.layer = new Konva.Layer();
    this.stage.add(this.layer);
  }

  exportAsJson() {
    const blob = new Blob([JSON.stringify(this.stage.toJSON())], {
      type: 'application/json;charset=utf-8',
    });
    saveAs(blob);
  }

  exportAsImage() {
    this.stage.toImage({
      callback: (iag) => {
        saveAs(iag.src);
      },
    });
  }

  openFileUpload() {
    document.getElementById('file')?.click();
  }

  addImage() {
    this.fileUploadMode = 'image';
    this.openFileUpload();
  }

  loadFromJson() {
    this.fileUploadMode = 'json';
    this.openFileUpload();
  }

  handleFileInput(event: any) {
    const file = event.files.item(0);
    let fileReader = new FileReader();
    if (this.fileUploadMode === 'json') {
      fileReader.onload = (e) => {
        const json = JSON.parse(fileReader.result as string);
        this.drawFromJson(json);
      };
      fileReader.readAsText(file);
    } else {
      fileReader.onload = (e) => {
        this.drawImage(fileReader.result);
      };
      fileReader.readAsDataURL(file);
    }
  }

  drawFromJson(json: any) {
    this.clearSelection();
    this.stage = Konva.Node.create(json, 'editor-container');

    this.stage.find('Image').each((imageNode: any) => {
      const nativeImage = new window.Image();
      nativeImage.onload = () => {
        imageNode.image(nativeImage);
        imageNode.getLayer().batchDraw();
      };
      nativeImage.src = imageNode.getAttr('source');
    });
  }

  drawImage(src: any) {
    const imageEl = new Image();
    imageEl.src = src;
    imageEl.onload = () => {
      const image = new Konva.Image({
        image: imageEl,
        x: 120,
        y: 50,
        draggable: true,
      });
      image.setAttr('source', src);

      this.layer.add(image);
      this.stage.add(this.layer);
      this.addTransformerListeners();
    };
  }

  setColor(color: string) {
    if (this.selectedElement) {
      this.selectedElement.fill(color);
      this.layer.draw();
    }
  }

  setTextStyle(style: string) {
    if (this.selectedElement && this.selectedElementType === 'Text') {
      (this.selectedElement as Konva.Text).fontStyle(style);
      this.layer.draw();
    }
  }

  setTextDecoration(style: string) {
    if (this.selectedElement && this.selectedElementType === 'Text') {
      (this.selectedElement as Konva.Text).textDecoration(style);
      this.layer.draw();
    }
  }

  setFontSize(event: any) {
    if (this.selectedElement && this.selectedElementType === 'Text') {
      (this.selectedElement as Konva.Text).fontSize(parseInt(event.value));
      this.layer.draw();
    }
  }
}
