import '@testing-library/jest-dom/vitest';

// O jsdom não implementa a abertura e o fechamento do dialog nativo.
HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
HTMLDialogElement.prototype.close = function () {
  this.open = false;
  this.dispatchEvent(new Event("close"));
};
