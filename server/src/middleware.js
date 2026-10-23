export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str
    .replace(/[<>'"&]/g, (c) => {
      const map = { '<': '<', '>': '>', "'": '\"', '"': '\"', '&': '&' };
      return map[c];
    })
    .trim();
};

export const validatePassword = (password) => {
  // Minimum 8 characters, at least 1 letter and 1 number
  const re = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
  return re.test(password);
};