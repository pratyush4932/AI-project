export const validatePhone = (phone) => {
  const regex = /^\+91\d{10}$/;
  return regex.test(phone);
};