import { useRef } from "react";
import styles from "./FileUpload.module.css";

export default function FileUpload({ accept, files, onChange }) {
  const inputRef = useRef();

  const handleAdd = (e) => {
    const newFiles = Array.from(e.target.files);
    onChange([...files, ...newFiles]);
    e.target.value = "";
  };

  const handleRemove = (idx) => {
    onChange(files.filter((_, i) => i !== idx));
  };

  return (
    <div className={styles.upload}>
      <button type="button" onClick={() => inputRef.current.click()} className={styles.addBtn}>파일 추가</button>
      <input ref={inputRef} type="file" accept={accept} multiple onChange={handleAdd} className={styles.hidden} />
      {files.length > 0 && (
        <ul className={styles.fileList}>
          {files.map((f, i) => (
            <li key={i} className={styles.fileItem}>
              <span className={styles.fileName}>{f.name}</span>
              <span className={styles.fileSize}>{(f.size / 1024).toFixed(0)}KB</span>
              <button type="button" onClick={() => handleRemove(i)} className={styles.removeBtn}>X</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
