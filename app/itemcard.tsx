import Image from "next/image";

export default function ItemCard({value}) {
  return (
<div className=" rounded overflow-hidden shadow-lg">
          <div className="px-6 py-4 flex items-center justify-center" >
            <div className="font-bold text-xl mb-2">{value}</div>

          </div>

        </div>
  );
}
