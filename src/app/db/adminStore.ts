

let adminData: { _id?: string } | null = null;

export const setAdminData = (data: Record<string, any>) => {
  adminData = data;
};

export const getAdminData = (): Record<string, any> | null => {
  return adminData;
};


export const getAdminId = () => {
    return adminData?._id;
}