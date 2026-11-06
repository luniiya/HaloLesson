import type { User } from "@halolesson/shared";

export default function Avatar({ user, className = "size-10 text-base" }: { user: Pick<User, "username" | "avatar">; className?: string }) {
  if (user.avatar) return <img src={user.avatar} alt="" className={`shrink-0 rounded-full object-cover ${className}`} />;
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-owl-pale font-black text-owl-deep ${className}`} aria-hidden="true">
      {user.username.slice(0, 1).toUpperCase()}
    </span>
  );
}
