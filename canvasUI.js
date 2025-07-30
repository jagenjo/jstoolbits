(function(global){
const ENABLED = 1
const TOP = 8
const MIDDLEV = 16
const BOTTOM = 32
const LEFT = 1
const MIDDLEH = 2
const RIGHT = 4
const TOPLEFT = TOP | LEFT
const TOPCENTER = TOP | MIDDLEH
const TOPRIGHT = TOP | RIGHT
const BOTTOMLEFT = BOTTOM | LEFT
const BOTTOMCENTER = BOTTOM | MIDDLEH
const BOTTOMRIGHT = BOTTOM | RIGHT
const CENTERLEFT = MIDDLEV | LEFT
const CENTERRIGHT = MIDDLEV | RIGHT
const CENTER = MIDDLEV | MIDDLEH

class Widget {
    static cursor = null
    static action = null
    static noKeyboard = true

    _id = null
    label = ""
    area = [0,0,100,100] //x,y,w,h
    region = [0,0,0,0] //in canvas space
    anchor = TOPLEFT
    parent = null
    ui=null
    children = []
    enabled = true
    hover = false
    active = false
    focus = false
    draw(ctx,style) { this.drawChildren(ctx,style) }
    drawChildren(ctx,style)  {
        for(let i = 0; i < this.children.length; i++)
        {
            const w = this.children[i]
            if(w.enabled === false) continue
            w.updateRegion()
            ctx.save()
            ctx.resetTransform();
            ctx.translate(w.region[0]+0.5,w.region[1]+0.5)
            w.draw(ctx,w.style || style)
            ctx.restore()
        }
    }
    onMouse(e) { return true }
    constructor(o){this.fromJSON(o);}
    set id(v){if(this.ui) throw "cannot change id if already has an UI"; this._id = v}
    get id(){return this._id}
    get x(){return this.area[0]}
    set x(v){this.area[0]=v}
    get y(){return this.area[1]}
    set y(v){this.area[1]=v}
    get width(){return this.area[2]}
    set width(v){this.area[2]=v}
    get height(){return this.area[3]}
    set height(v){this.area[3]=v}
    fromJSON(o){if(o) for(var i in o) this[i]=o[i]}
    add(w) {
        if(!(w instanceof Widget)) throw "thats not a valid widget, it doesnt inherits from Widget"
        if(w.parent) throw "already has parent";
        this.children.push(w); w.parent = this;
        w.setUI(this.ui)
        return w
    }
    remove(w){let index = this.children.indexOf(w); if(index !== -1) { this.children.splice(index); w.parent = null; w.setUI(null)}}
    destroy(){ if(this.onDestroy) this.onDestroy(); this.parent?.remove(this) }
    hasAncestor(w){ if(this === w) return true; if(!this.parent) return false; return this.parent.hasAncestor(w) }
    setUI(ui){
        const oldui = this.ui
        this.ui=ui;
        if(this.id){
            if(ui) ui.widgets_by_id.set(this.id,this)
            else if(oldui) oldui.widgets_by_id.delete(this.id)
        }
        this.children.forEach(w=>w.setUI(ui));
        if(this.onUI) this.onUI(ui)
    }
    getWidget(id){return this.ui?.widgets_by_id.get(id)}
    
    processMouse(m) //expect mouse in local to this widget
    {
        let used = this.onMouse(m)
        this.children.forEach((w)=>{
            if(w.enabled === false) return
            if(inArea(m.x,m.y,w.region))
            {
                m.localX = m.x - w.region[0]
                m.localY = m.y - w.region[1]
                used|=w.processMouse(m)
            }
        })
        return used
    }
    findWidgetAtPos(x,y){
        if(!inArea(x,y,this.region))
            return null
        for(let i = this.children.length-1; i >= 0; i--)
        {
            const w = this.children[i]
            if(w.enabled === false) continue
            var inside = w.findWidgetAtPos(x,y);
            if(inside) return inside;
        }
        return this
    }
    //compute world offset
    getOffset(){
        if(!this.parent)
            return [this.area[0],this.area[1]]
        let offset = this.parent.getOffset()
        let local_offset = this.getLocalOffset()
        offset[0] += local_offset[0]
        offset[1] += local_offset[1]
        return offset
    }

    //compute local offset from parent based on anchor
    getLocalOffset() {
        let x = this.area[0]
        let y = this.area[1]
        if(this.parent)
        {
            const p = this.parent;
            if(this.anchor & MIDDLEH)
                x += Math.floor(p.area[2] / 2)
            if(this.anchor & RIGHT)
                x += p.area[2]
            if(this.anchor & MIDDLEV)
                y += Math.floor(p.area[3] / 2)
            if(this.anchor & BOTTOM)
                y += p.area[3]
        }
        return [x,y]
    }

    updateRegion(){
        const [x,y] = this.getOffset()
        this.region[0] = x
        this.region[1] = y
        this.region[2] = this.area[2]
        this.region[3] = this.area[3]
    }
}

class StaticText extends Widget {
    linked = null
    constructor(o){super(o);this.linked = o.linked || null}
    draw(ctx,style){
        ctx.textAlign = style?.textAlign || "left"
        ctx.fillStyle = style?.textColor || "white"
        ctx.fillText( this.linked?.value.toFixed(2) || this.label, 0, this.area[3] * 0.65)
    }
}

class TextInput extends Widget {
    value = ""
    constructor(o){ super(); this.fromJSON(o) }
    draw(ctx,style){
        const [x,y,w,h] = this.area       
        ctx.strokeStyle = style?.textBorder || "white"
        ctx.strokeRect(0,0,w,h)
        if(this.hover) ctx.strokeRect(1,1,w-2,h-2)
        ctx.textAlign = "left"
        ctx.fillStyle = style?.textColor || "white"
        ctx.fillText( "> " + this.value + (this.focus && ((performance.now()/500)%1<0.5)? "_" : ""), 4, this.area[3] * 0.65)
    }

    onMouse(e) {
        if( e.type === "pointerdown" && Widget.noKeyboard )
        {
            setTimeout(()=>{this.value = prompt( "Enter value", this.value ); this.focus = false},100)
        }
    }

    onKey(e)
    {
        if(e.type !== "keydown")
            return
        if(e.code === "Enter")
        {
            this.ui.focusOn(null)
            if(this.onEnter)
                this.onEnter(this.value,this)
        }
        else if(e.code === "Backspace")
        {
            this.value = this.value.slice(0,-1)
            if(this.onChange)
                this.onChange(this.value, this)
        }
        else if(e.key.length === 1)
        {
            this.value += e.key
            if(this.onChange)
                this.onChange(this.value, this)
        }
    }
}

class Button extends Widget {
    icon = null
    target = null
    property = null
    constructor(o){ super(); this.fromJSON(o) }
    draw(ctx,style){
        if(this.target && this.property)
            this.selected = this.target[this.property]
        const [x,y,w,h] = this.area
        let bgColor = this.hover ? (style?.buttonBgHover || "transparent") : (style?.buttonBg || "black")
        if(this.active || this.selected ) bgColor = (style?.buttonBgActive || "white")
        ctx.fillStyle = bgColor
        ctx.fillRect(0,0,w,h)
        ctx.strokeStyle = style?.buttonBorder || "white"
        ctx.strokeRect(0,0,w,h)
        if(this.hover) ctx.strokeRect(1,1,w-2,h-2)
        ctx.textAlign = "center"
        ctx.fillStyle = (this.active || this.selected) ? "black" : "white"
        ctx.fillText( this.label, w/2 + (this.icon?8:0), h * 0.65)
        if(this.icon)
            this.ui.drawIcon(ctx,this.icon,this.label ? 8 : w/2-8,h/2-8,this.active || this.selected)
        if(this.extra)
            ctx.fillText( String.fromCharCode( 0x000025B6 ) , w-10, h * 0.65)
    }
    onMouse(e)
    {
        if(e.type === "pointerdown")
        {
            if(this.target && this.property)
                this.target[this.property] = !this.selected
            this.onClick?.(this,e)
        }
        return true
    }
    click(){ this.onClick?.(this) }
}

class Slider extends Widget {
    value = 0
    range = [0,1]
    display = false
    binsize = 20
    target = null
    property = null
    border = true

    constructor(o){ super(); this.fromJSON(o) }
    draw(ctx,style){
        if(this.target && this.property)
            this.value = this.target[ this.property ]

        const [x,y,w,h] = this.area
        ctx.fillStyle = "black"
        ctx.fillRect(0,0,w,h)
        if(this.border)
        {
            ctx.strokeStyle = "white"
            ctx.strokeRect(0,0,w,h)
            if(this.hover || this.active) ctx.strokeRect(1,1,w-2,h-2)
        }
        var v = remap(this.value,this.range[0],this.range[1],0,Math.max(w,h)-this.binsize)
        ctx.fillStyle = "white"
        if(w>h)
            ctx.fillRect(v,0,this.binsize,h)
        else
            ctx.fillRect(0,v,w,this.binsize)
        if( this.display )
        {
            ctx.textAlign = "left"
            ctx.fillText( this.value.toFixed(2), this.area[2] + 10, this.area[3] * 0.6 )
        }
    }

    onMouse(m)
    {
        if(this.active)
        {
            var oldvalue = this.value
            if(this.area[2] > this.area[3])
                this.value = clamp( remap(m.localX,0,this.area[2]-this.binsize,this.range[0],this.range[1]), ...this.range )
            else
                this.value = clamp( remap(m.localY,0,this.area[3]-this.binsize,this.range[0],this.range[1]), ...this.range )
            if(this.onChange && oldvalue !== this.value)
                this.onChange(this.value, this, oldvalue)
            if(this.target && this.property)
                this.target[ this.property ] = this.value
        }
        return true
    }
}

class Checkbox extends Widget {
    value = false
    target = null
    property = null
    constructor(o){ super(); this.fromJSON(o) }
    draw(ctx,style){
        const [x,y,w,h] = this.area       
        var binsize = h/2;
        var margin = Math.floor(binsize/2)
        ctx.fillStyle = "white"
        ctx.textAlign = "left"
        ctx.fillText(this.label,10,h*0.6)
        ctx.strokeStyle = "white"
        if(this.hover) ctx.strokeRect(w-margin-binsize-1,margin-1,binsize+2,binsize+2)
        if(this.value)
            ctx.fillRect(w-margin-binsize,margin,binsize,binsize)
        else
        {
            ctx.strokeRect(w-margin-binsize,margin,binsize,binsize)
        }
    }

    onMouse(m)
    {
        const [x,y,w,h] = this.area       
        var binsize = h/2;
        var margin = Math.floor(binsize/2)
        var oldvalue = this.value
        if(m.type === "pointerdown")// && inArea(m.localX,m.localY,[w-margin-binsize,margin,binsize,binsize]))
        {
            if(this.onChange && oldvalue !== this.value)
                this.onChange(this.value, this, oldvalue)
            this.value = !this.value
            if(this.target)
                this.target[this.property] = this.value
        }
        return true
    }
}

class ComboBox extends Widget {
    contextMenu = null
    constructor(o){ super(); this.fromJSON(o) }
    draw(ctx,style){
        const [x,y,w,h] = this.area       
        ctx.fillStyle = this.active ? (style?.buttonBgActive || "white") : (style?.buttonBg || "black")
        ctx.fillRect(0,0,w,h)
        ctx.strokeStyle = style?.buttonBorder || "white"
        ctx.strokeRect(0,0,w,h)
        if(this.hover) ctx.strokeRect(1,1,w-2,h-2)
        ctx.textAlign = "center"
        ctx.fillStyle = this.active ? "black" : "white"
        let label = this.values[this.value]
        if(label.constructor !== String && label.label)
            label = label.label
        ctx.fillText( label, w/2, h * 0.65)
        ctx.fillText( String.fromCharCode( this.contextMenu ? 0x000025B2 : 0x000025BC ) , w-10, h * 0.65)
        if(this.contextMenu)
        {
            const offset = this.getOffset();
            this.contextMenu.area = [offset[0],offset[1]+this.area[3],this.area[2], this.values.length * 20]
        }
    }
    onMouse(e)
    {
        if(e.type === "pointerdown")
        {
            if(!this.contextMenu)
            {
                const offset = this.getOffset();
                this.contextMenu = new ContextMenu({selected: this.value, values: this.values, area:[offset[0],offset[1]+this.area[3],this.area[2],0]});
                this.contextMenu.onChange = (item,c,index)=>{
                    this.value = index
                    this.contextMenu = this.contextMenu.destroy()
                }
                this.ui.add(this.contextMenu)
            }
            else
            {
                this.contextMenu.destroy()
                this.contextMenu = null
            }
        }
        return true
    }    
}

class Frame extends Widget {
    img = null
    img_area = null
    constructor(o){ super(); this.fromJSON(o); if(o.url){this.img = new Image(); this.img.src = o.url;} }
    draw(ctx,style) {
        //bg
        const [x,y,w,h] = this.area
        ctx.fillStyle = style?.frameBg || "black"
        ctx.fillRect(0,0,w,h)

        //content
        ctx.save()
        ctx.beginPath();
        ctx.rect(0,0,w,h)
        ctx.clip()
        if(this.img && this.img.width)
        {
            if(this.nofilter)
                ctx.imageSmoothingEnabled = false
            if(this.img_area)
                ctx.drawImage(this.img,...this.img_area,0.5,0.5,this.area[2],this.area[3])
            else
                ctx.drawImage(this.img,0.5,0.5)
        }
        this.onDrawContent?.(ctx,style,this)
        ctx.restore()

        //border
        ctx.strokeStyle = style?.frameBorder || "white"
        ctx.strokeRect(0,0,w,h)
    }
}

class Panel extends Widget {
    resizable = false
    movable = false
    closable = false
    titlebar = true
    offset = [0,0]
    constructor(o){ super(); this.fromJSON(o) }

    draw(ctx,style) {
        const [x,y,w,h] = this.area
        
        //shadow
        ctx.fillStyle = style?.panelShadow || "rgba(0,0,0,0.5)"
        ctx.fillRect(4,4,w,h)

        //bg
        ctx.fillStyle = style?.panelBg || "black"
        ctx.fillRect(0,0,w,h)

        if(this.children.length)
        {
            ctx.save()
            ctx.beginPath();
            ctx.rect(0,0,w,h)
            ctx.clip()
            for(let i = 0; i < this.children.length; i++)
            {
                const widget = this.children[i]
                if(widget.enabled === false) continue
                widget.updateRegion()
                ctx.save()
                ctx.resetTransform();
                ctx.translate(widget.region[0]+0.5,widget.region[1]+0.5)
                widget.draw(ctx,widget.style || style)
                ctx.restore()
            }
            ctx.restore()
        }

        //titlebar
        if(this.titlebar)
        {
            ctx.fillStyle = style?.panelTitleBg || "white"
            ctx.fillRect(0,0,w,20)
            ctx.fillStyle = style?.panelTitleText ||"black"
            ctx.fillText( this.label, 10, 15)

            if(this.closable)
            {
                ctx.fillStyle = "black"
                ctx.fillRect(w - 15,5,10,10)
            }
        }

        //border
        ctx.strokeStyle = style?.panelBorder || "white"
        ctx.strokeRect(0,0,w,h)
        if(this.active && ( this.movable || this.resizable) )
            ctx.strokeRect(1,1,w-2,h-2)
    }

    onMouse(e)
    {
        const [x,y,w,h] = this.area
        let action = null

        if(this.resizable && e.localX > (this.area[2] - 10) && e.localY > (this.area[3] - 10))
        {
            action = "resize"
            Widget.cursor = "nwse-resize"
        }
        else if(this.movable && e.localX < (this.area[2] - 20) && e.localY < 20)
        {
            action = "move"
            Widget.cursor = "move"
        }

        if(e.type === "pointerdown")
        {
            if(this.closable && inArea(e.localX,e.localY,[w - 15,5,10,10]))
            {
                action = null
                this.close();
            }
            
            Widget.action = action
        }

        if(e.type === "pointermove" && this.active)
        {
            if(Widget.action == "move")
            {
                this.area[0] += e.deltaX
                this.area[1] += e.deltaY
            }
            else if(Widget.action == "resize")
            {
                this.area[2] = Math.max( 20, e.localX )
                this.area[3] = Math.max( 20, e.localY )
            }
        }

        return true
    }

    modal(ui) {
        ui = ui || this.ui
        if(!ui)
            throw "to make it modal it needs to have a ui"
        if(this.parent)
            this.parent.remove( this );
        this.area[0] = Math.floor(ui.width * 0.5 - this.width * 0.5)
        this.area[1] = Math.floor(ui.height * 0.5 - this.height * 0.5)
        ui.modalWidget = this
        ui.add( this )
    }

    close() {
        if(this.onClose)
            this.onClose();
        if(this.ui?.modalWidget === this)
            this.ui.modalWidget = null;
        this.destroy();
    }

    addButton( settings ) {
        if(!settings.area)
        {
            const last = this.children.at(-1)
            const pos = last ? last.x + last.width : 0
            settings.area = this.width > this.height ? [ pos + 2, 2, 30,30] : [2, pos + 2, 30,30]
        }
        const b = new Button(settings)
        this.add(b)
        return b
    }
}

class ContextMenu extends Panel {
    values = []
    titlebar = false
    movable = false
    resizable = false
    subContextMenu = null
    parentContextMenu = null

    constructor(o){
        super()
        this.fromJSON(o)
        this.area[3] = this.values.length * 20
        for(let i = 0; i < this.values.length; i++)
        {
            let item = this.values[i]
            if(item === null)
                continue
            let label = item
            if(item.constructor !== String && item.label)
                label = item.label
            var button = new Button({data:i,label,extra:Boolean(item.values), item,area:[1,i*20+1,this.area[2]-2,19],style:{buttonBgHover:"#222",buttonBorder:"transparent",buttonBg:i===this.selected?"#444":"transparent"}});
            button.onEnter = (b)=>{
                if(this.subContextMenu)
                    this.subContextMenu.destroy()
                if(b.item && b.item.values)
                {
                    var offset = b.getOffset();
                    if(this.subContextMenu)
                        this.subContextMenu.destroy()
                    this.subContextMenu = new ContextMenu({values: b.item.values, area:[offset[0]+b.area[2],offset[1],this.area[2],b.item.values.length*20]});
                    this.subContextMenu.onDestroy = ()=>{ this.subContextMenu = null }
                    this.subContextMenu.parentContextMenu = this
                    this.ui.add(this.subContextMenu)
                }
            }
            button.onClick=(b,e)=>{
                if(b.item && b.item.values)
                {
                }
                else
                {
                    if(this.onChange)
                        this.onChange(b.item, this, b.data, e)
                    this.destroy();
                    if(this.parentContextMenu?.onChange)
                        this.parentContextMenu?.onChange(b.item, this, b.data, e)
                    this.parentContextMenu?.destroy();
                }
            }
            this.add(button)
        }
    }
}

class Topbar extends Widget {
    values = []
    contextMenu = null
    constructor(o){
        super()
        this.fromJSON(o)
        this.rebuild();
    }

    draw(ctx,style)
    {
        this.area[2] = this.parent.area[2]
        Widget.prototype.draw.call(this,ctx,style)
        ctx.fillStyle = "white"
        ctx.fillRect(0,this.height-0.5,this.width,1)
    }

    rebuild( values )
    {
        if(values)
            this.values = values
        while(this.children.length)
            this.children[0].destroy()
        for(let i = 0; i < this.values.length; i++)
        {
            this.add( new Button({ label: this.values[i].label, item: this.values[i], style: {buttonBgHover: "#333", buttonBorder: "transparent"}, data: i, area: [i*100,0,100,20]}) )
            .onClick = (v)=>{ this.onOpenMenu(v.data) }
        }
    }

    onOpenMenu(i){
        const menu = this.values[i]
        if(!menu.values || this.contextMenu){
            this.ui.closeAllContextMenus()
            this.contextMenu = null
            return
        }
        const offset = this.getOffset()
        this.contextMenu = new ContextMenu({values:menu.values,area:[offset[0]+i*100,offset[1]+this.area[3],100,menu.values.length*20]})
        this.contextMenu.onChange = (v,c,i,e)=>{
            //console.log(v,i,c)
            if(this.onSelect)
                this.onSelect(v,c,i,e)
            c.destroy()
        }
        this.contextMenu.onDestroy = ()=>{
            setTimeout( ()=>{this.contextMenu = null},10); //delay
        }
        this.ui.add(this.contextMenu)
    }

    onUI(ui) {
        this.area = [0,(this.parent instanceof Panel) && this.parent.titlebar ? 20 : 0,this.parent.width,20]
    }
}


class UI extends Widget {
    hoverWidget = null
    activeWidget = null
    focusWidget = null
    modalWidget = null
    lastpos = [0,0]
    icons = null
    widgets_by_id = new Map()

    constructor(o){
        super();
        this.ui = this;
        if(o.icons)
        {
            this.icons = new Image()
            this.icons.src = o.icons
        }
        const device = ["iPhone","iPad","Android"]
        Widget.noKeyboard = false
        device.forEach((v)=>{if(navigator.userAgent.indexOf(v) !== -1) Widget.noKeyboard = true})
        
    }
    draw(ctx,style) { 

        this.area[2] = ctx.canvas.width        
        this.area[3] = ctx.canvas.height
        this.region.copyFrom(this.area)
        ctx.font = "14px monospace"
        for(let i = 0; i < this.children.length; i++)
        {
            const w = this.children[i]
            if(w.enabled === false) continue
            w.updateRegion()

            if(this.modalWidget === w)
            {
                ctx.globalAlpha = 0.5
                ctx.fillStyle = "black"
                ctx.fillRect(0,0,this.width,this.height)
                ctx.globalAlpha = 1
            }
    
            ctx.save()
            ctx.resetTransform();
            ctx.translate(w.region[0]+0.5,w.region[1]+0.5)
            w.draw(ctx,w.style||style)
            ctx.restore()

            if(this.modalWidget === w)
                break;
        }

        ctx.fillStyle = "white"
        //ctx.fillText( Widget.action || "", ctx.canvas.width/2,40)
        //ctx.fillText( navigator.userAgent, 10,14 )

        ctx.canvas.style.cursor = Widget.cursor || ""
    }
    drawIcon(ctx,index,x,y,reverse){
        if(!this.icons || !this.icons.width)
            return
        const ix = index%16
        const iy = Math.floor(index/16)
        if(reverse)
        {
            ctx.globalCompositeOperation = "difference"
            ctx.drawImage(this.icons,ix*16,iy*16,16,16,Math.floor(x)+0.5,Math.floor(y)+0.5,16,16)
            ctx.globalCompositeOperation = "source-over"
        }
        else
        ctx.drawImage(this.icons,ix*16,iy*16,16,16,Math.floor(x)+0.5,Math.floor(y)+0.5,16,16)
    }
    onMouse(e){
        if(e.offsetX === undefined)
            return
        const oldhover = this.hoverWidget
        let newhover = null
        const deltaX = e.offsetX - this.lastpos[0]
        const deltaY = e.offsetY - this.lastpos[1]
        Widget.cursor = null
        const x = e.offsetX, y = e.offsetY
        this.lastpos[0] = x || 0
        this.lastpos[1] = y || 0

        const mouse = { x, y, localX: x, localY: y, deltaX, deltaY, buttons: e.buttons, type: e.type, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey }
        let w = this.findWidgetAtPos(x,y);
        if(w && this.modalWidget && !w.hasAncestor(this.modalWidget))
            w = null;
        this.hoverWidget = w;

        //handle active
        const oldactive = this.activeWidget

        if(e.type === "pointerdown")
        {
            this.focusOn(w)
            this.closeAllContextMenus();
    
            Widget.action = null
            if(this.activeWidget)
                this.activeWidget.active = false
            this.activeWidget = w
            if(this.activeWidget)
                this.activeWidget.active = true
        }

        let used = false
        if(this.activeWidget && e.type !== "pointerdown")
        {
            newhover = this.activeWidget
            var offset = this.activeWidget.getOffset()
            mouse.localX -= offset[0]
            mouse.localY -= offset[1]
            used = this.activeWidget.processMouse(mouse)
        }
        else if(w)
        {
            newhover = w
            var offset = w.getOffset()
            mouse.localX -= offset[0]
            mouse.localY -= offset[1]
            used = w.processMouse(mouse)
        }
        else
            used = false

        if(e.type === "pointerup")
        {
            Widget.action = null
            if(this.activeWidget)
                this.activeWidget.active = false
            this.activeWidget = null
        }

        if(this.modalWidget)
            used = true
            
        if(oldhover != newhover)
        {
            if(oldhover)
            {
                oldhover.hover = false
                if(oldhover.onLeave)
                    oldhover.onLeave(oldhover,e)
            }
            if(newhover)
            {
                newhover.hover = true
                if(newhover.onEnter)
                    newhover.onEnter(newhover,e)
            }
        }

        return used
    }

    onKey(event) {
        if(this.focusWidget && this.focusWidget.onKey)
            return this.focusWidget.onKey(event);
        return false
    }

    focusOn(w)
    {
        if(w === this)
            return
            
        if(this.focusWidget)
        {
            this.focusWidget.focus = false
            if(this.focusWidget.onBlur)
                this.focusWidget.onBlur()
        }
        this.focusWidget = w
        if(this.focusWidget)
        {
            this.focusWidget.focus = true
            if(this.focusWidget.onFocus)
                this.focusWidget.onFocus()
        }
    }

    closeAllContextMenus(e)
    {
        for(let i = 0; i < this.children.length; i++)
        {
            const w = this.children[i]
            if(w instanceof ContextMenu )// && !w.subContextMenu)
            {
                w.destroy();
                i--;
            }
        }
    }

    demo() {
        let icon_selected = 0
        var p = new Panel({label:"Panel", movable: true, resizable: true, closable: true, area:[100,100,500,640]})
        this.add(p)
        p.add( new Topbar({values:[{label:"Files",values:["Load",{label:"Save",values:["Save As","Rename"]},null,{ label: "Exit", values: ["Im sure","Not sure"]}]},{label:"Edit"},{label:"Actions",values:["Go","Stay"]}]}) ).onSelect = (v)=>{
            console.log(v)
        }
        p.add( new StaticText({label:"Hello World", area:[10,40,100,30]}))
        p.add( new Button({id:"toggle",label:"Clickme", icon:4, area:[10,70,100,30], style: {buttonBg:"blue"}}))
        p.add( new Slider({value:0.5, area:[10,110,100,30],display: true}))
        //p.add( new Slider({value:0.5, area:[p.area[2]-20,20,20,p.height-20],display: true}))
        p.add( new Checkbox({label: "checkbox", value:true, area:[10,150,100,30]}))
        p.add( new TextInput({value:"hello world", area:[10,190,140,30]}))
        p.add( new ComboBox({values:["Hello","World","Everybody","Extra"],value:0, area:[10,230,140,30]}))

        p.add( new Button({label:"Center",anchor: BOTTOMCENTER, area:[-60,-40,120,30]}))

        const zoom = p.add( new Frame({id:"zoom", area:[200,60+260,256,256],url:"icons-1bit.png",img_area:[16,0,16,16],nofilter:true}) )
        p.add( new Frame({id:"frame", area:[200,50,256,256],url:"icons-1bit.png"}) ).onDrawContent = function(ctx){
            if(!this.hover) return
            const offset = this.getOffset()
            let x = Math.floor((this.ui.lastpos[0]-offset[0])/16)
            let y = Math.floor((this.ui.lastpos[1]-offset[1])/16)
            if(x > 16 || y > 16 || x < 0 || y < 0) return
            ctx.strokeStyle="yellow"
            ctx.strokeRect(x*16,y*16,16,16)
            ctx.fillStyle = "white"
            icon_selected = y*16+x
            ctx.textAlign = "left"
            ctx.fillText(icon_selected,10,this.area[3]-20)
            zoom.img_area[0] = x*16
            zoom.img_area[1] = y*16
        }
        this.getWidget("toggle").onClick = ()=>{const f = this.getWidget("frame"); f.enabled = !f.enabled}

        var modal = new Panel({title:"Modal Example", closable: true, area:[0,0,200,100]})
        modal.add( new Button({label:"Accept",area:[20,40,100,20]})).onClick = ()=>modal.close()
        p.add( new Button({id:"showmodal",label:"Show Modal", area:[10,270,100,30]})).onClick = ()=>{
            modal.modal(this);
        }
        p.add( new Button({label: "ContextMenu", area:[10,310,100,30]})).onClick = (b,e)=>{
            this.add(new ContextMenu({values:["foo","faa","fii"],area:[e.x,e.y,200,0]})).onChange = (v,c,i)=>{
                console.log(v)
                c.destroy()
            }
        }

        var buttons = []
        for(let i = 0; i < 4; i++)
        {
            const b = new Button({icon: i+1,area:[160,50+i*40,30,30]});
            b.onClick = (b,e)=>{ buttons.forEach(b=>b.selected = false); b.selected = true }
            p.add(b)
            buttons.push(b)
        }
    }
}

function inPositiveBox(x,y,w,h) { return x >= 0 && y >= 0 && x < w && y < h }
function inArea(x,y,area) { return  x >= area[0] && y >= area[1] && x < area[0] + area[2] && y < area[1] + area[3] }
function remap(v,low1,high1,low2,high2) { return (v - low1)/(high1-low1)*(high2-low2)+low2}
function clamp(v,min,max) { return v < min ? min : (v > max ? max : v)}
Array.prototype.copyFrom = function(a) { for(let i = 0; i < a.length; i++) this[i] = a[i] }
global.CUI = {
    UI,
    Widget,
    Panel,
    Button,
    Slider,
    StaticText,
    TextInput,
    ComboBox,
    Checkbox,
    Topbar,
    Frame,
    TOP,MIDDLEV,BOTTOM,LEFT,MIDDLEH,RIGHT,TOPLEFT,TOPCENTER,TOPRIGHT,BOTTOMLEFT,BOTTOMCENTER,BOTTOMRIGHT,CENTERLEFT,CENTERRIGHT,CENTER
}

})(this)