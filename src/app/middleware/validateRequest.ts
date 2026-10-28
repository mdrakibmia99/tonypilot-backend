import { NextFunction, Request, Response } from 'express';
// import { AnyZodObject } from 'zod';
import catchAsync from '../utils/catchAsync';
// import { AnyZodObject } from 'zod/v3';

const validateRequest = (schema: any) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const validateData = await schema.parseAsync({
      body: req.body,
      params: req.params,
      query: req.query,
      files: req.files,
      file: req.file,
      cookies: req.cookies,
    });

    if (validateData.body !== undefined) req.body = validateData.body;
    if (validateData.params !== undefined) req.params = validateData.params;
    if (validateData.query !== undefined) req.query = validateData.query;

    next();
  });
};

export default validateRequest;
