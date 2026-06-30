let _io = null;

module.exports = {
  setIO: (io) => _io = io,
  getIO: () => _io,
};
