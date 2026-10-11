export class HttpError extends Error {
    status:number;
    constructor(status:number,message:string){
        super(message);
        this.status = status;
    }
}

export function errorResponse(error:unknown):Response{
    if(error instanceof HttpError){
        return new Response(JSON.stringify({error:error.message}),{
            status:error.status,
            headers:{
                "Content-Type": "application/json"
            }
        });
    }else{
        return new Response(JSON.stringify({error:"Internal Server Error"}),{
            status:500,
            headers:{
                "Content-Type": "application/json"
            }
        });
    }
}