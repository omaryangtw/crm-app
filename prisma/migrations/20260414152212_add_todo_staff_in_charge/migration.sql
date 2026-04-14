-- CreateTable
CREATE TABLE "_StaffToTodo" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_StaffToTodo_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_StaffToTodo_B_index" ON "_StaffToTodo"("B");

-- AddForeignKey
ALTER TABLE "_StaffToTodo" ADD CONSTRAINT "_StaffToTodo_A_fkey" FOREIGN KEY ("A") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StaffToTodo" ADD CONSTRAINT "_StaffToTodo_B_fkey" FOREIGN KEY ("B") REFERENCES "todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
