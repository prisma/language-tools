export const regression_602 = `
  import { NextApiRequest, NextApiResponse } from 'next'

  import { primsa } from "~/lib/db";
  import { requestWrapper } from "~/lib/auth/jwt";
  
  export default async (req: NextApiRequest, res) => {
    await requestWrapper(req, res, async (token: any) => {
      const posts = await prisma.post.findMany();
      res.status(200).json()({posts})
    })
  }
  `

