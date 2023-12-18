export default class ObsTransformer {
  activityDelta = 1;
  tlookup = {
    "11.11": 1,
    "999999999": 1,
  };

  constructor(currentWidth, currentHeight, currentScale, crop = {}) {
    console.log(crop);
    this.startX = parseInt(process.env.START_X);
    this.startY = parseInt(process.env.START_Y);
    this.startWidth = parseInt(process.env.START_WIDTH);
    this.startHeight = parseInt(process.env.START_HEIGHT);
    this.currentWidth = currentWidth;
    this.currentHeight = currentHeight;
    this.currentScale = currentScale;
    this.minimumSize = parseFloat(process.env.MINIMUM_SIZE);
    this.maximumSize = parseFloat(process.env.MAXIMIUM_SIZE);
    this.cropBottom = crop?.bottom || 0;
    this.cropLeft = crop?.left || 0;
    this.cropRight = crop?.right || 0;
    this.cropTop = crop?.top || 0;

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
      return false;
    }

    return scale;
  }

  transform(amount) {
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
