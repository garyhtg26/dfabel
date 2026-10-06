export type Service = {id:string;name:string;description:string;price:number;unit:string;days:string;icon:string};
export type Order = {id:string;token:string;name:string;phone:string;service:string;kg:number;actualKg:number|null;express:boolean;address:string;lat:number;lng:number;date:string;slot:string;notes:string;photo:string;status:number;paid:boolean;total:number;unitPrice:number;washPrice:number;source:'web'|'pos';createdAt:string;history:{status:number;at:string}[]};
export type Store = {services:Service[];orders:Order[];promo:{title:string;description:string;code:string;active:boolean}};
export const statuses=['Menunggu konfirmasi','Dijadwalkan jemput','Dalam penjemputan','Ditimbang di toko','Sedang dicuci','Finishing & quality check','Dalam pengantaran','Selesai'];
export const money=(v:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(v);
