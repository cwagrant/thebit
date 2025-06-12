export default class ObsTransformer {
  activityDelta = 1;
  tlookup = {
    "11.11": 1,
    "999999999": 1,
  };
  shaderSettings = {}
  active = false;
  activeModifier = null;

  constructor(currentWidth, currentHeight, currentScale) {
    this.startX = parseInt(process.env.START_X);
    this.startY = parseInt(process.env.START_Y);
    this.startWidth = parseInt(process.env.START_WIDTH);
    this.startHeight = parseInt(process.env.START_HEIGHT);
    this.currentWidth = currentWidth;
    this.currentHeight = currentHeight;
    this.currentScale = currentScale;
    this.minimumSize = parseFloat(process.env.MINIMUM_SIZE);
    this.maximumSize = parseFloat(process.env.MAXIMIUM_SIZE);
    this.posX = this.startX;
    this.posY = this.startY;
    this.angle = 0;

    setInterval(() => {
      if (this.activityDelta < 1) {
        this.activityDelta += 0.01;
      }
    }, 3000);
  }

  #clamp(number) {
    if (number < this.minimumSize) {
      return this.minimumSize;
    } else if (number > this.maximumSize) {
      return this.maximumSize;
    }
    return number;
  }

  #clampAt(number, min, max) {
    if (number < min) {
      return min;
    } else if (number > max) {
      return max;
    }
    return number;
  }

  addLookupScale(amount, scale) {
    this.tlookup[`${amount}`] = scale;
  }

  removeLookupScale(key) {
    delete this.tlookup[key];
  }

  lookupScale(amount) {
    const key = amount?.toString();

    const scale = this.tlookup[key];
    if (!scale) {
      return false
    }

    return scale;
  }

  shader({ name }) {
    return {
      from_file: true,
      shader_file_name: `${process.env.SHADER_FOLDER}${name}`,
    }
  }

  move(position, inBounds = false) {
    this.currentScale = 0.5;
    this.currentWidth = this.startWidth * this.currentScale;
    this.currentHeight = this.startHeight * this.currentScale;
    this.posX = this.startX;
    this.posY = this.startY;

    const horizontalCenter = this.startWidth / 2;
    const verticalCenter = this.startHeight / 2;
    const halfWidth = this.currentWidth / 2;
    const halfHeight = this.currentHeight / 2;

    if (position === "left") {
      this.posX = inBounds ? this.startX : this.startX - halfWidth
      this.posY = verticalCenter - halfHeight;
    } else if (position === "right") {
      this.posX = this.startWidth - (inBounds ? this.currentWidth : halfWidth)
      this.posY = verticalCenter - (this.currentHeight * this.currentScale)
    } else if (position === "up") {
      this.posX = horizontalCenter - (this.currentWidth * this.currentScale)
      this.posY = inBounds ? this.startY : this.startY - halfHeight;
    } else if (position === "down") {
      this.posX = horizontalCenter - (this.currentWidth * this.currentScale)
      this.posY = this.startHeight - (inBounds ? this.currentHeight : halfHeight)
    } else {
      this.posX = this.startX;
      this.posY = this.startY;
      this.currentScale = 1;
    }

    console.log({
      posX: this.posX,
      posY: this.posY,
      scale: this.currentScale
    })

    return {
      pos: {
        x: this.posX,
        y: this.posY,
      },
      scale: {
        x: this.currentScale,
        y: this.currentScale
      }
    }
  }

  scale(scale) {
    this.currentScale = parseFloat(scale)
    this.currentWidth = this.startWidth * this.currentScale;
    this.currentHeight = this.startHeight * this.currentScale;

    this.posX = this.startX + ((this.startWidth - this.currentWidth) / 2)
    this.posY = this.startY + ((this.startHeight - this.currentHeight) / 2)

    return {
      pos: {
        x: this.posX,
        y: this.posY,
      },
      scale: {
        x: this.currentScale,
        y: this.currentScale
      }
    }
  }

  getTransform(flipH = false) {
    return {
      pos: {
        x: this.posX,
        y: this.posY,
      },
      rot: this.angle,
      scale: {
        x: (flipH ? -1 : 1) * this.currentScale,
        y: this.currentScale
      }
    }
  }

  reset() {
    this.active = false;
    this.currentScale = 1;
    this.currentWidth = this.startWidth;
    this.currentHeight = this.startHeight;
    this.posX = this.startX;
    this.posY = this.startY;
    this.angle = 0;
  }

  flipH() {
    const flipped = this.posX == 1920
    this.currentScale = 1;
    this.currentWidth = this.startWidth;
    this.currentHeight = this.startHeight;
    this.posX = this.posX == 1920 ? 0 : this.startWidth;

    return this.getTransform(!flipped)
  }

  angleToRadians() {
    return this.angle * (Math.PI / 180);
  }

  fixPosition() {
    const screenHeight = this.startHeight;
    const screenWidth = this.startWidth;
    const centerX = screenWidth / 2;
    const centerY = screenHeight / 2;

    return {
      pos: {
        x: centerX + (this.currentWidth * Math.sin(this.angleToRadians())),
        y: centerY - (this.currentHeight * Math.sin(this.angleToRadians()))
      }
    }
  }

  toggle(modifier) {
    this.active = !this.active;
    this.activeModifier = this.active ? modifier : null;

    return this.active
  }

  rotate(angle) {
    this.angle = parseInt(angle);

    const isSideways = (angle % 180) == 90
    const upsideDown = (angle % 360) >= 180
    this.currentScale = isSideways ? (9 / 16) : 1
    this.currentWidth = this.startWidth * this.currentScale;
    this.currentHeight = this.startHeight * this.currentScale;

    if (isSideways) {
      this.posX = upsideDown ? (this.startWidth / 2) - (this.currentHeight / 2) : (this.startWidth / 2) + (this.currentHeight / 2);
    } else {
      this.posX = upsideDown ? this.startWidth : this.startX;
      this.posY = upsideDown ? this.startHeight : this.startY;
    }

    return {
      pos: {
        x: this.posX,
        y: this.posY,
      },
      rot: this.angle,
      scale: {
        x: this.currentScale,
        y: this.currentScale
      }
    }
  }

  // need to set it up so that we can move the game based on chat saying left/down/right/up on the screen
  scaleWithDonationAmount(amount) {
    const lookup = this.lookupScale(amount);
    const donationCents = parseInt(amount * 100);
    const adjustSign = (donationCents % 2) ? 1 : -1;
    const baseDelta = donationCents / 99900;
    let newSize = this.currentScale +
      (baseDelta * this.activityDelta * adjustSign);

    if (lookup) {
      newSize = lookup;
    }

    this.currentScale = this.#clamp(newSize);
    this.currentWidth = this.startWidth * this.currentScale;
    this.currentHeight = this.startHeight * this.currentScale;
    this.activityDelta *= 0.95;

    const posX = this.startX + ((this.startWidth - this.currentWidth) / 2);
    const posY = this.startY + ((this.startHeight - this.currentHeight) / 2);

    console.log({
      currentScale: this.currentScale,
      activityDelta: this.activityDelta,
      baseDelta: baseDelta,
      adjustSign: adjustSign,
      baseDelta: baseDelta,
      donationCents: donationCents,
      newSize: newSize,
      crop: {
        bottom: this.cropBottom,
        left: this.cropLeft,
        right: this.cropRight,
        top: this.cropTop,
      },
    });

    return {
      pos: {
        x: posX,
        y: posY,
      },
      scale: {
        x: this.currentScale,
        y: this.currentScale,
      },
      crop: {
        bottom: this.cropBottom,
        left: this.cropLeft,
        right: this.cropRight,
        top: this.cropTop,
      },
    };
  }
}
