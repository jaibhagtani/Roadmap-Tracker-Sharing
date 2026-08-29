export type Status='not_started'|'in_progress'|'completed';
export type ResourceType='youtube'|'github'|'article'|'course'|'book'|'documentation'|'other';
export type Topic={id:string;roadmap_id:string;parent_id:string|null;title:string;description:string;notes:string;status:Status;progress:number;priority:number;position:number;tags:string[];due_date:string|null};
export type Resource={id:string;topic_id:string;title:string;url:string;type:ResourceType;notes:string;completed:boolean;favorite:boolean};
export type Roadmap={id:string;owner_id:string;title:string;description:string;privacy:'private'|'link'|'public';share_slug:string;created_at:string};
